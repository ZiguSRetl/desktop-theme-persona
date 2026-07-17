use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::{Command, Output};
use std::sync::Mutex;
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use sysinfo::{Components, Disks, Networks, System};

#[cfg(windows)]
use std::os::windows::process::CommandExt;

/// Hide console flashes when spawning `nvidia-smi` / PowerShell on Windows.
#[cfg(windows)]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

fn run_hidden_command(program: &str, args: &[&str]) -> Option<Output> {
    let mut cmd = Command::new(program);
    cmd.args(args);
    #[cfg(windows)]
    {
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    cmd.output().ok()
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DiskMetricsDto {
    pub usage_percent: f32,
    pub used_bytes: u64,
    pub total_bytes: u64,
    pub mount_point: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NetworkMetricsDto {
    pub download_bytes_per_second: u64,
    pub upload_bytes_per_second: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuDeviceDto {
    pub id: String,
    pub name: String,
    pub vendor: String,
    pub supports_metrics: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GpuMetricsDto {
    pub id: String,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub usage_percent: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vram_used_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vram_total_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature_celsius: Option<f32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SystemStatsDto {
    pub cpu_usage_percent: f32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpu_temperature_celsius: Option<f32>,
    pub memory_used_bytes: u64,
    pub memory_total_bytes: u64,
    pub os_name: String,
    pub host_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gpu_name: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub gpu: Option<GpuMetricsDto>,
    pub timestamp: u64,
    pub disk: Option<DiskMetricsDto>,
    pub network: Option<NetworkMetricsDto>,
}

struct NetworkSample {
    at: Instant,
    received: u64,
    transmitted: u64,
}

pub struct SystemStatsState {
    inner: Mutex<SystemStatsInner>,
}

struct SystemStatsInner {
    system: System,
    disks: Disks,
    networks: Networks,
    previous_network: Option<NetworkSample>,
    /// Skip slow WMI thermal probes for a while after a failure.
    wmi_temp_backoff_until: Option<Instant>,
    /// Skip `nvidia-smi` when missing / empty (common on non-NVIDIA machines).
    nvidia_backoff_until: Option<Instant>,
    /// WMI GPU names rarely change; avoid PowerShell every poll.
    cached_wmi_gpus: Option<(Instant, Vec<GpuDeviceDto>)>,
}

impl Default for SystemStatsState {
    fn default() -> Self {
        let mut system = System::new();
        system.refresh_cpu_usage();
        system.refresh_memory();

        // Do NOT initialize sysinfo::Components here: on Windows it touches WMI/COM
        // (often MTA) on the UI thread and breaks Tauri's OleInitialize (STA).
        let disks = Disks::new_with_refreshed_list();
        let networks = Networks::new_with_refreshed_list();

        Self {
            inner: Mutex::new(SystemStatsInner {
                system,
                disks,
                networks,
                previous_network: None,
                wmi_temp_backoff_until: None,
                nvidia_backoff_until: None,
                cached_wmi_gpus: None,
            }),
        }
    }
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn build_os_name() -> String {
    let name = System::name().unwrap_or_else(|| "Windows".to_string());
    let version = System::os_version().unwrap_or_default();
    if version.is_empty() {
        name
    } else {
        format!("{name} {version}")
    }
}

fn build_host_name() -> String {
    System::host_name().unwrap_or_else(|| "Equipo desconocido".to_string())
}

fn is_plausible_cpu_temp(celsius: f32) -> bool {
    celsius.is_finite() && (0.0..=125.0).contains(&celsius)
}

fn cpu_temp_label_score(label: &str) -> i32 {
    let lower = label.to_ascii_lowercase();
    if lower.contains("gpu")
        || lower.contains("nvme")
        || lower.contains("ssd")
        || lower.contains("hdd")
        || lower.contains("wifi")
        || lower.contains("battery")
        || lower.contains("pch")
    {
        return -100;
    }

    let mut score = 0;
    if lower.contains("package") || lower.contains("tctl") || lower.contains("tdie") {
        score += 50;
    }
    if lower.contains("cpu") {
        score += 40;
    }
    if lower.contains("core") {
        score += 20;
    }
    if lower.contains("thermal") || lower == "computer" {
        score += 5;
    }
    score
}

fn pick_cpu_temperature_from_components(components: &Components) -> Option<f32> {
    let mut best: Option<(i32, f32)> = None;

    for component in components.list() {
        let Some(temp) = component.temperature() else {
            continue;
        };
        if !is_plausible_cpu_temp(temp) {
            continue;
        }
        let score = cpu_temp_label_score(component.label());
        if score < 0 {
            continue;
        }
        match best {
            Some((best_score, _)) if best_score >= score => {}
            _ => best = Some((score, temp)),
        }
    }

    best.map(|(_, temp)| temp)
}

#[cfg(windows)]
fn query_wmi_thermal_temperature() -> Option<f32> {
    let output = run_hidden_command(
        "powershell",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "(Get-CimInstance -Namespace root/WMI -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue | Select-Object -ExpandProperty CurrentTemperature -First 1)",
        ],
    )?;

    if !output.status.success() {
        return None;
    }

    let raw = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if raw.is_empty() {
        return None;
    }

    let tenths_kelvin = raw.parse::<f32>().ok()?;
    // WMI reports tenths of Kelvin.
    let celsius = (tenths_kelvin / 10.0) - 273.15;
    if is_plausible_cpu_temp(celsius) {
        Some(celsius)
    } else {
        None
    }
}

#[cfg(not(windows))]
fn query_wmi_thermal_temperature() -> Option<f32> {
    None
}

fn read_cpu_temperature_from_sysinfo() -> Option<f32> {
    // Run on a worker thread so WMI/COM stays off the Tauri UI thread.
    std::thread::spawn(|| {
        let components = Components::new_with_refreshed_list();
        pick_cpu_temperature_from_components(&components)
    })
    .join()
    .ok()
    .flatten()
}

fn read_cpu_temperature(inner: &mut SystemStatsInner) -> Option<f32> {
    if let Some(temp) = read_cpu_temperature_from_sysinfo() {
        return Some(temp);
    }

    if let Some(until) = inner.wmi_temp_backoff_until {
        if Instant::now() < until {
            return None;
        }
    }

    match query_wmi_thermal_temperature() {
        Some(temp) => {
            inner.wmi_temp_backoff_until = None;
            Some(temp)
        }
        None => {
            inner.wmi_temp_backoff_until = Some(Instant::now() + Duration::from_secs(60));
            None
        }
    }
}

fn classify_vendor(name: &str) -> &'static str {
    let lower = name.to_ascii_lowercase();
    if lower.contains("nvidia")
        || lower.contains("geforce")
        || lower.contains("quadro")
        || lower.contains("rtx ")
        || lower.contains("gtx ")
    {
        "nvidia"
    } else if lower.contains("amd") || lower.contains("radeon") {
        "amd"
    } else if lower.contains("intel") || lower.contains("uhd") || lower.contains("iris") {
        "intel"
    } else {
        "unknown"
    }
}

fn names_match(a: &str, b: &str) -> bool {
    let a = a.to_ascii_lowercase();
    let b = b.to_ascii_lowercase();
    a == b || a.contains(&b) || b.contains(&a)
}

fn parse_csv_fields(line: &str) -> Vec<String> {
    line.split(',').map(|part| part.trim().to_string()).collect()
}

fn parse_f32_field(raw: &str) -> Option<f32> {
    let trimmed = raw.trim().trim_matches(|c: char| c == '[' || c == ']');
    if trimmed.is_empty() || trimmed.eq_ignore_ascii_case("N/A") {
        return None;
    }
    trimmed.parse::<f32>().ok()
}

fn parse_u64_mib_to_bytes(raw: &str) -> Option<u64> {
    let mib = parse_f32_field(raw)?;
    if !mib.is_finite() || mib < 0.0 {
        return None;
    }
    Some((mib as u64).saturating_mul(1024 * 1024))
}

#[derive(Debug, Clone)]
struct NvidiaGpuSample {
    id: String,
    name: String,
    usage_percent: Option<f32>,
    vram_used_bytes: Option<u64>,
    vram_total_bytes: Option<u64>,
    temperature_celsius: Option<f32>,
}

fn run_nvidia_smi(args: &[&str]) -> Option<String> {
    let output = run_hidden_command("nvidia-smi", args)?;
    if !output.status.success() {
        return None;
    }
    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        None
    } else {
        Some(text)
    }
}

fn query_nvidia_gpus() -> Vec<NvidiaGpuSample> {
    let Some(stdout) = run_nvidia_smi(&[
        "--query-gpu=index,uuid,name,utilization.gpu,memory.used,memory.total,temperature.gpu",
        "--format=csv,noheader,nounits",
    ]) else {
        return Vec::new();
    };

    let mut gpus = Vec::new();
    for line in stdout.lines() {
        let line = line.trim();
        if line.is_empty() {
            continue;
        }
        let fields = parse_csv_fields(line);
        // index, uuid, name (may contain commas rarely), util, mem.used, mem.total, temp
        if fields.len() < 7 {
            continue;
        }
        if fields[0].parse::<u32>().is_err() {
            continue;
        }
        let uuid = fields[1].trim();
        if uuid.is_empty() {
            continue;
        }
        // Name can theoretically contain commas; take middle slice if oversize.
        let (name, usage_idx) = if fields.len() == 7 {
            (fields[2].clone(), 3)
        } else {
            let last_metric_start = fields.len() - 4;
            (fields[2..last_metric_start].join(", "), last_metric_start)
        };
        let usage = parse_f32_field(&fields[usage_idx]).map(|v| v.clamp(0.0, 100.0));
        let vram_used = parse_u64_mib_to_bytes(&fields[usage_idx + 1]);
        let vram_total = parse_u64_mib_to_bytes(&fields[usage_idx + 2]);
        let temperature = parse_f32_field(&fields[usage_idx + 3]);

        gpus.push(NvidiaGpuSample {
            id: format!("nvidia:{uuid}"),
            name: name.trim().to_string(),
            usage_percent: usage,
            vram_used_bytes: vram_used,
            vram_total_bytes: vram_total,
            temperature_celsius: temperature,
        });
    }

    gpus
}

#[cfg(windows)]
fn query_wmi_gpus() -> Vec<GpuDeviceDto> {
    let output = run_hidden_command(
        "powershell",
        &[
            "-NoProfile",
            "-NonInteractive",
            "-Command",
            "Get-CimInstance Win32_VideoController | Select-Object Name, PNPDeviceID | ConvertTo-Json -Compress",
        ],
    );

    let Some(output) = output else {
        return Vec::new();
    };
    if !output.status.success() {
        return Vec::new();
    }

    let text = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if text.is_empty() {
        return Vec::new();
    }

    #[derive(serde::Deserialize)]
    struct WmiGpu {
        #[serde(rename = "Name")]
        name: Option<String>,
        #[serde(rename = "PNPDeviceID")]
        pnp_device_id: Option<String>,
    }

    let parsed: Result<Vec<WmiGpu>, _> = serde_json::from_str(&text);
    let devices = match parsed {
        Ok(list) => list,
        Err(_) => match serde_json::from_str::<WmiGpu>(&text) {
            Ok(single) => vec![single],
            Err(_) => return Vec::new(),
        },
    };

    devices
        .into_iter()
        .filter_map(|device| {
            let name = device.name?.trim().to_string();
            if name.is_empty() {
                return None;
            }
            let pnp = device
                .pnp_device_id
                .unwrap_or_default()
                .trim()
                .to_string();
            let id = if pnp.is_empty() {
                format!("wmi:{}", name.to_ascii_lowercase().replace(' ', "-"))
            } else {
                format!("wmi:{pnp}")
            };
            Some(GpuDeviceDto {
                id,
                vendor: classify_vendor(&name).to_string(),
                name,
                supports_metrics: false,
            })
        })
        .collect()
}

#[cfg(not(windows))]
fn query_wmi_gpus() -> Vec<GpuDeviceDto> {
    Vec::new()
}

fn merge_gpu_devices(nvidia: &[NvidiaGpuSample], wmi: Vec<GpuDeviceDto>) -> Vec<GpuDeviceDto> {
    let mut devices: Vec<GpuDeviceDto> = nvidia
        .iter()
        .map(|gpu| GpuDeviceDto {
            id: gpu.id.clone(),
            name: gpu.name.clone(),
            vendor: "nvidia".to_string(),
            supports_metrics: true,
        })
        .collect();

    for candidate in wmi {
        let matched = nvidia.iter().any(|gpu| names_match(&gpu.name, &candidate.name));
        if matched {
            continue;
        }
        devices.push(candidate);
    }

    devices.sort_by(|a, b| match (a.supports_metrics, b.supports_metrics) {
        (true, false) => std::cmp::Ordering::Less,
        (false, true) => std::cmp::Ordering::Greater,
        _ => a.name.to_ascii_lowercase().cmp(&b.name.to_ascii_lowercase()),
    });

    devices
}

fn build_gpu_device_list() -> Vec<GpuDeviceDto> {
    merge_gpu_devices(&query_nvidia_gpus(), query_wmi_gpus())
}

fn nvidia_to_metrics(gpu: &NvidiaGpuSample) -> GpuMetricsDto {
    GpuMetricsDto {
        id: gpu.id.clone(),
        name: gpu.name.clone(),
        usage_percent: gpu.usage_percent,
        vram_used_bytes: gpu.vram_used_bytes,
        vram_total_bytes: gpu.vram_total_bytes,
        temperature_celsius: gpu.temperature_celsius,
    }
}

fn device_name_only(device: &GpuDeviceDto) -> GpuMetricsDto {
    GpuMetricsDto {
        id: device.id.clone(),
        name: device.name.clone(),
        usage_percent: None,
        vram_used_bytes: None,
        vram_total_bytes: None,
        temperature_celsius: None,
    }
}

const NVIDIA_BACKOFF: Duration = Duration::from_secs(60);
const WMI_GPU_CACHE: Duration = Duration::from_secs(30);

fn query_nvidia_gpus_cached(inner: &mut SystemStatsInner) -> Vec<NvidiaGpuSample> {
    if let Some(until) = inner.nvidia_backoff_until {
        if Instant::now() < until {
            return Vec::new();
        }
    }

    let gpus = query_nvidia_gpus();
    if gpus.is_empty() {
        inner.nvidia_backoff_until = Some(Instant::now() + NVIDIA_BACKOFF);
    } else {
        inner.nvidia_backoff_until = None;
    }
    gpus
}

fn query_wmi_gpus_cached(inner: &mut SystemStatsInner) -> Vec<GpuDeviceDto> {
    if let Some((at, devices)) = &inner.cached_wmi_gpus {
        if at.elapsed() < WMI_GPU_CACHE {
            return devices.clone();
        }
    }

    let devices = query_wmi_gpus();
    inner.cached_wmi_gpus = Some((Instant::now(), devices.clone()));
    devices
}

fn resolve_gpu_metrics(
    inner: &mut SystemStatsInner,
    gpu_id: Option<&str>,
) -> Option<GpuMetricsDto> {
    let nvidia = query_nvidia_gpus_cached(inner);
    let explicit = gpu_id.map(str::trim).filter(|id| !id.is_empty());

    match explicit {
        None => {
            if let Some(gpu) = nvidia.first() {
                return Some(nvidia_to_metrics(gpu));
            }
            let devices = merge_gpu_devices(&nvidia, query_wmi_gpus_cached(inner));
            devices.first().map(device_name_only)
        }
        Some(id) => {
            if let Some(gpu) = nvidia.iter().find(|gpu| gpu.id == id) {
                return Some(nvidia_to_metrics(gpu));
            }
            let devices = merge_gpu_devices(&nvidia, query_wmi_gpus_cached(inner));
            devices
                .iter()
                .find(|device| device.id == id)
                .map(device_name_only)
        }
    }
}

fn preferred_roots() -> Vec<PathBuf> {
    let mut roots = Vec::new();

    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            roots.push(parent.to_path_buf());
        }
        roots.push(exe);
    }

    if let Ok(drive) = std::env::var("SYSTEMDRIVE") {
        let trimmed = drive.trim_end_matches(['\\', '/']);
        if !trimmed.is_empty() {
            roots.push(PathBuf::from(format!("{trimmed}\\")));
        }
    }

    roots.push(PathBuf::from("/"));
    roots
}

fn path_on_mount(path: &Path, mount: &Path) -> bool {
    path.starts_with(mount)
}

fn select_primary_disk(disks: &Disks) -> Option<DiskMetricsDto> {
    let list = disks.list();
    if list.is_empty() {
        return None;
    }

    let roots = preferred_roots();
    let mut chosen = None;

    for root in &roots {
        if let Some(disk) = list.iter().find(|disk| path_on_mount(root, disk.mount_point())) {
            chosen = Some(disk);
            break;
        }
    }

    if chosen.is_none() {
        chosen = list
            .iter()
            .filter(|disk| !disk.is_removable() && disk.total_space() > 0)
            .max_by_key(|disk| disk.total_space());
    }

    if chosen.is_none() {
        chosen = list.iter().filter(|disk| disk.total_space() > 0).max_by_key(|d| d.total_space());
    }

    let disk = chosen?;
    let total_bytes = disk.total_space();
    if total_bytes == 0 {
        return None;
    }

    let used_bytes = total_bytes.saturating_sub(disk.available_space());
    let usage_percent = ((used_bytes as f64 / total_bytes as f64) * 100.0).clamp(0.0, 100.0) as f32;

    Some(DiskMetricsDto {
        usage_percent,
        used_bytes,
        total_bytes,
        mount_point: disk.mount_point().to_string_lossy().into_owned(),
    })
}

fn is_ignored_interface(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.contains("loopback")
        || lower.contains("isatap")
        || lower.contains("teredo")
        || lower.contains("vethernet")
        || lower.starts_with("veth")
        || lower.starts_with("docker")
        || lower.starts_with("br-")
        || lower == "lo"
}

fn sum_network_totals(networks: &Networks) -> (u64, u64) {
    let mut received = 0u64;
    let mut transmitted = 0u64;

    for (name, data) in networks.list() {
        if is_ignored_interface(name) {
            continue;
        }
        // Skip interfaces that never carried traffic (often virtual placeholders).
        if data.total_received() == 0 && data.total_transmitted() == 0 {
            continue;
        }
        received = received.saturating_add(data.total_received());
        transmitted = transmitted.saturating_add(data.total_transmitted());
    }

    (received, transmitted)
}

fn compute_network_rate(
    previous: &Option<NetworkSample>,
    received: u64,
    transmitted: u64,
    now: Instant,
) -> Option<NetworkMetricsDto> {
    let previous = previous.as_ref()?;
    let elapsed = now.duration_since(previous.at).as_secs_f64();
    if elapsed <= 0.0 {
        return None;
    }

    let download = if received >= previous.received {
        ((received - previous.received) as f64 / elapsed).round() as u64
    } else {
        0
    };
    let upload = if transmitted >= previous.transmitted {
        ((transmitted - previous.transmitted) as f64 / elapsed).round() as u64
    } else {
        0
    };

    Some(NetworkMetricsDto {
        download_bytes_per_second: download,
        upload_bytes_per_second: upload,
    })
}

#[tauri::command]
pub fn list_gpus() -> Result<Vec<GpuDeviceDto>, String> {
    Ok(build_gpu_device_list())
}

#[tauri::command]
pub fn get_system_stats(
    state: tauri::State<'_, SystemStatsState>,
    gpu_id: Option<String>,
) -> Result<SystemStatsDto, String> {
    let mut inner = state
        .inner
        .lock()
        .map_err(|_| "No se pudo acceder al estado del sistema.".to_string())?;

    inner.system.refresh_cpu_usage();
    inner.system.refresh_memory();
    inner.disks.refresh(true);
    inner.networks.refresh(true);

    let cpu_usage_percent = inner.system.global_cpu_usage().clamp(0.0, 100.0);
    let cpu_temperature_celsius = read_cpu_temperature(&mut inner);
    let memory_total_bytes = inner.system.total_memory();
    let memory_used_bytes = inner.system.used_memory();
    let disk = select_primary_disk(&inner.disks);

    let now = Instant::now();
    let (received, transmitted) = sum_network_totals(&inner.networks);
    let network = compute_network_rate(&inner.previous_network, received, transmitted, now);
    inner.previous_network = Some(NetworkSample {
        at: now,
        received,
        transmitted,
    });

    let gpu = resolve_gpu_metrics(&mut inner, gpu_id.as_deref());
    let gpu_name = gpu.as_ref().map(|g| g.name.clone());

    Ok(SystemStatsDto {
        cpu_usage_percent,
        cpu_temperature_celsius,
        memory_used_bytes,
        memory_total_bytes,
        os_name: build_os_name(),
        host_name: build_host_name(),
        gpu_name,
        gpu,
        timestamp: now_ms(),
        disk,
        network,
    })
}
