import { useCollection } from "../lib/useCollection";
import { useI18n } from "../lib/i18n";
import type { AuditDoc } from "../lib/types";

export default function AuditLog() {
  const { t } = useI18n();
  const { data, loading } = useCollection<AuditDoc>("auditLogs");

  const sorted = [...data].sort((a, b) => {
    const av = (a.at as any)?.seconds ?? 0;
    const bv = (b.at as any)?.seconds ?? 0;
    return bv - av;
  });

  return (
    <section>
      <h2>{t("auditLog")}</h2>
      {loading ? <p>{t("loading")}</p> : sorted.length === 0 ? (
        <p className="info">{t("noAudit")}</p>
      ) : (
        <div className="list">
          {sorted.slice(0, 200).map((x) => (
            <div className="card" key={x.id}>
              <div className="row between">
                <strong>{x.action}</strong>
                <small>{x.email || x.uid || ""}</small>
              </div>
              <div>{x.message}</div>
              {x.target ? <small>{x.target.type} · {x.target.id}</small> : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
