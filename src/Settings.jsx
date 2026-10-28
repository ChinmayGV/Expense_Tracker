import AccountManager from "./AccountManager.jsx";

function Settings({ accounts, onAccountsChanged, theme, onThemeChange }) {
  // Props provide account settings data/actions and the selected appearance; this page has no local state.
  return <section className="management-page settings-page">
    <div className="page-heading-row"><div><p className="eyebrow">YOUR SPACE, YOUR WAY</p><h1>Settings</h1><p className="page-subtitle">Manage your accounts and how the app looks.</p></div></div>
    <section className="panel appearance-panel"><div className="panel-heading"><div><p className="eyebrow">APPEARANCE</p><h2>Color theme</h2></div><span className="appearance-icon" aria-hidden="true">◐</span></div><p>Choose a comfortable look for your workspace.</p><div className="theme-picker" role="group" aria-label="Color theme"><button className={theme === "light" ? "theme-option selected" : "theme-option"} aria-pressed={theme === "light"} onClick={() => onThemeChange("light")}><span className="theme-preview light-preview" aria-hidden="true">☼</span><span>Light</span></button><button className={theme === "dark" ? "theme-option selected" : "theme-option"} aria-pressed={theme === "dark"} onClick={() => onThemeChange("dark")}><span className="theme-preview dark-preview" aria-hidden="true">☾</span><span>Dark</span></button></div></section>
    <AccountManager accounts={accounts} onChanged={onAccountsChanged} />
    <section className="panel privacy-settings"><span className="privacy-icon" aria-hidden="true">◈</span><div><strong>Private by default</strong><p>Your records are stored in a local SQLite database and the API listens on this device only.</p></div></section>
  </section>;
}

export default Settings;
