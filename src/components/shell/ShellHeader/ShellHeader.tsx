import { useRef } from "react";
import { useLocation } from "react-router-dom";
import { ComicClock, pathnameToSection } from "../../comic";
import { sectionTitle } from "../../../lib/sectionTitles";
import { HeaderSearch, type HeaderSearchHandle } from "../HeaderSearch/HeaderSearch";
import styles from "./ShellHeader.module.css";

export function ShellHeader() {
  const location = useLocation();
  const section = pathnameToSection(location.pathname);
  const searchRef = useRef<HeaderSearchHandle>(null);

  return (
    <header className={styles.header}>
      <div className={styles.titleBlock}>
        <h1 className={styles.title}>{sectionTitle(section)}</h1>
        <span className={styles.titleUnderline} aria-hidden="true" />
      </div>

      <HeaderSearch ref={searchRef} />

      <div className={styles.clockSlot}>
        <ComicClock />
      </div>
    </header>
  );
}
