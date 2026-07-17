// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    let args: Vec<String> = std::env::args().collect();
    if args.iter().any(|arg| arg == tauri_app_lib::system_clean::CLEAN_WORKER_FLAG) {
        let output_path = args
            .iter()
            .find_map(|arg| arg.strip_prefix(tauri_app_lib::system_clean::CLEAN_OUTPUT_PREFIX))
            .and_then(|path| {
                let trimmed = path.trim_matches('"');
                if trimmed.is_empty() {
                    None
                } else {
                    Some(std::path::PathBuf::from(trimmed))
                }
            });

        if let Some(output_path) = output_path {
            if let Err(error) = tauri_app_lib::system_clean::run_clean_worker_to_file(&output_path) {
                eprintln!("{error}");
                std::process::exit(1);
            }
            return;
        }
    }

    tauri_app_lib::run()
}
