import "@testing-library/jest-dom/vitest";
import { setOsFamilyOverrideForTests } from "../features/system/platform";

// Unit tests assume the Windows product defaults unless a suite overrides the host OS.
setOsFamilyOverrideForTests("windows");
