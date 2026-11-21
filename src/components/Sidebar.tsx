import {
  Bookmark,
  Clock3,
  Compass,
  Home,
  ListChecks,
  Settings,
  UserRound,
} from "lucide-react";
import type { Language, LoginState, Screen } from "../types";
import { translate } from "../i18n";
import type { TranslationKey } from "../i18n";

interface SidebarProps {
  language: Language;
  screen: Screen;
  loginState: LoginState;
  customText: string;
  collapsed?: boolean;
  onNavigate: (screen: Screen) => void;
  onLogin: () => void;
}

export function Sidebar({
  language,
  screen,
  loginState,
  customText,
  collapsed = false,
  onNavigate,
  onLogin,
}: SidebarProps) {
  const customTextColumns = customText
    .split(/\n+|\\{2}/)
    .map((part) => part.trim())
    .filter(Boolean);

  const items: {
    screen: Screen;
    label: TranslationKey;
    icon: typeof Home;
  }[] = [
    { screen: "home" as const, label: "navHome", icon: Home },
    { screen: "lists" as const, label: "navLists", icon: ListChecks },
    { screen: "search" as const, label: "navExplore", icon: Compass },
    { screen: "library" as const, label: "navLibrary", icon: Bookmark },
    { screen: "history" as const, label: "navHistory", icon: Clock3 },
    { screen: "settings" as const, label: "navSettings", icon: Settings },
  ];

  return (
    <aside
      className={collapsed ? "sidebar collapsed" : "sidebar"}
      aria-hidden={collapsed}
    >
      <div className="sidebar-primary">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              type="button"
              key={item.screen}
              className={
                screen === item.screen ? "side-item active" : "side-item"
              }
              onClick={() => onNavigate(item.screen)}
            >
              <span className="side-icon">
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <span>{translate(language, item.label)}</span>
            </button>
          );
        })}

      </div>

      {customTextColumns.length > 0 && (
        <div
          className="sidebar-custom-text"
          aria-label={customTextColumns.join("，")}
        >
          {customTextColumns.map((column, index) => (
            <span key={`${index}-${column}`}>{column}</span>
          ))}
        </div>
      )}

      <div className="sidebar-secondary">
        <button className="side-item login-item" type="button" onClick={onLogin}>
          <span className={loginState.loggedIn ? "avatar connected" : "avatar"}>
            {loginState.loggedIn ? (
              loginState.avatarUrl ? (
                <img
                  className="sidebar-avatar-image"
                  src={loginState.avatarUrl}
                  alt=""
                />
              ) : (
                <UserRound size={19} />
              )
            ) : (
              <UserRound size={19} />
            )}
          </span>
          <span className="sidebar-account-name">
            {loginState.loggedIn
              ? loginState.userName || translate(language, "connected")
              : translate(language, "login")}
          </span>
        </button>
      </div>
    </aside>
  );
}
