import { useUserGeolocation } from "@/hooks/useUserGeolocation";
import { useI18nStore } from "@/hooks/useI18nStore";

export default function UserLocationControl() {
  const location = useUserGeolocation();
  const t = useI18nStore(s => s.t);
  return <details className="user-location-control">
    <summary aria-label={t("map.location.locateMe")}><i className="bi bi-crosshair" /> {t("map.location.title")}</summary>
    <div className="location-panel">
      <button type="button" onClick={location.locate} disabled={location.status === "requesting"}>{t("map.location.locateMe")}</button>
      <p role="status">{t(`map.location.${location.status}`)}</p>
      <small>{t("map.location.permissionHint")}</small>
      {location.latitude !== null && <>
        <p>{t("map.location.title")}: {location.latitude.toFixed(6)}, {location.longitude?.toFixed(6)}<br />{t("map.location.accuracy")}: {Math.round(location.accuracy ?? 0)} m<br />{t("map.location.lastUpdated")}: {new Date(location.timestamp ?? 0).toLocaleTimeString()}</p>
        <label><input type="checkbox" checked={location.visible} onChange={e => location.setVisible(e.target.checked)} />{t("map.location.show")}</label>
        <button type="button" onClick={() => location.setFollow(!location.follow)}>{t(location.follow ? "map.location.stopFollowing" : "map.location.follow")}</button>
      </>}
    </div>
  </details>;
}
