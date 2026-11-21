import {
  CheckCircle2,
  Clock3,
  ExternalLink,
  LockKeyhole,
  QrCode,
  UserRound,
  X,
} from "lucide-react";
import type { Language, LoginState } from "../types";
import { translate } from "../i18n";

interface AuthModalProps {
  language: Language;
  loginState: LoginState;
  watchTimeSeconds: number;
  onClose: () => void;
  onOpenLogin: () => void;
}

export function AuthModal({
  language,
  loginState,
  watchTimeSeconds,
  onClose,
  onOpenLogin,
}: AuthModalProps) {
  const totalMinutes = Math.floor(watchTimeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const watchTimeLabel =
    language === "zh"
      ? hours > 0
        ? `${hours} 小时 ${minutes} 分钟`
        : `${minutes} 分钟`
      : hours > 0
        ? `${hours}h ${minutes}m`
        : `${minutes}m`;

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label={translate(language, "close")}
        >
          <X size={18} />
        </button>
        <div
          className={
            loginState.loggedIn ? "qr-visual connected-visual" : "qr-visual"
          }
        >
          <span className="qr-corner one" />
          <span className="qr-corner two" />
          <span className="qr-corner three" />
          {loginState.loggedIn ? (
            loginState.avatarUrl ? (
              <img
                className="profile-hero-avatar"
                src={loginState.avatarUrl}
                alt={loginState.userName || "Bilibili avatar"}
              />
            ) : (
              <UserRound size={56} />
            )
          ) : (
            <QrCode size={56} />
          )}
        </div>
        <h2 id="auth-title">{translate(language, "officialLogin")}</h2>
        <p>{translate(language, "loginHelp")}</p>

        {loginState.loggedIn ? (
          <div className="connected-profile">
            <div className="profile-identity">
              <div className="profile-identity-copy">
                <strong>
                  {loginState.userName ||
                    (language === "zh" ? "B站用户" : "Bilibili user")}
                </strong>
                <span>
                  UID {loginState.userId || "--"}
                </span>
              </div>
              <span className="profile-connected-badge">
                <CheckCircle2 size={14} />
                {translate(language, "connected")}
              </span>
            </div>
            <div className="profile-stats">
              <div className="profile-watch-time">
                <Clock3 size={16} />
                <strong>{watchTimeLabel}</strong>
                <span>{language === "zh" ? "真实观看时长" : "Watch time"}</span>
              </div>
            </div>
          </div>
        ) : (
          <button className="primary-button auth-button" type="button" onClick={onOpenLogin}>
            <ExternalLink size={17} />
            {translate(language, "openOfficialLogin")}
          </button>
        )}

        <div className="privacy-note">
          <LockKeyhole size={15} />
          <span>{translate(language, "loginNote")}</span>
        </div>
      </div>
    </div>
  );
}
