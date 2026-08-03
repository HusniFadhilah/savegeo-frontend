import { useEffect, useState } from "react";
import { fetchLandCoverDatasets } from "@/features/landcover/api";
import type { LandCoverDatasetCatalog, LandCoverParams } from "@/features/landcover/types";
import SearchableMultiSelect from "@/components/ui/SearchableMultiSelect";

interface Props {
  params: LandCoverParams;
  onParamsChange: (patch: Partial<LandCoverParams>) => void;
}

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des",
];

/** Ported from module-carbon.html's #landcoverParams block. */
export default function LandCoverParamsPanel({ params, onParamsChange }: Props) {
  const [catalog, setCatalog] = useState<LandCoverDatasetCatalog>({});

  useEffect(() => {
    fetchLandCoverDatasets()
      .then((res) => {
        if (res) setCatalog(res);
      })
      .catch(() => {
        /* dataset picker falls back to no options; user sees empty select */
      });
  }, []);

  function toggleDataset(key: string) {
    const active = params.datasets.includes(key);
    const next = active ? params.datasets.filter((d) => d !== key) : [...params.datasets, key];
    onParamsChange({ datasets: next });
  }

  const datasetList = Object.values(catalog);

  return (
    <div id="landcoverParams">
      <h6 className="mb-3">
        <i className="bi bi-map me-1" /> Dataset Tutupan Lahan
      </h6>

      <div className="mb-3">
        <label className="form-label">Dataset LULC</label>
        <SearchableMultiSelect
          value={params.datasets}
          onChange={(datasets) => onParamsChange({ datasets })}
          options={datasetList.map((ds) => ({
            value: ds.key,
            label: ds.name,
            description: ds.resolution ? `Resolusi ${ds.resolution}` : undefined,
          }))}
          placeholder="Cari dataset LULC..."
        />
        <select
          id="landcoverDatasetSelect"
          className="visually-hidden"
          aria-hidden="true"
          tabIndex={-1}
          multiple
          value={params.datasets}
          onChange={(e) =>
            onParamsChange({
              datasets: Array.from(e.currentTarget.selectedOptions).map((opt) => opt.value),
            })
          }
        >
          {datasetList.map((ds) => (
            <option key={ds.key} value={ds.key}>
              {ds.name}
            </option>
          ))}
          {!datasetList.length &&
            ["Dynamic_World", "ESA_WorldCover", "ESRI_LandCover", "MODIS_LandCover", "Copernicus_LandCover"].map(
              (key) => (
                <option key={key} value={key}>
                  {key.replace(/_/g, " ")}
                </option>
              ),
            )}
        </select>
        <small className="text-muted d-block mt-1">
          Pilih satu atau beberapa dataset LULC.
        </small>
        {!datasetList.length && (
          <div className="d-flex flex-wrap gap-2 mt-2">
            {["Dynamic_World", "ESA_WorldCover", "ESRI_LandCover", "MODIS_LandCover", "Copernicus_LandCover"].map(
              (key) => (
                <span
                  key={key}
                  className={`index-badge ${params.datasets.includes(key) ? "active" : ""}`}
                  onClick={() => toggleDataset(key)}
                >
                  {key.replace(/_/g, " ")}
                </span>
              ),
            )}
          </div>
        )}
      </div>

      <div className="mb-3">
        <label className="form-label">Mode Dynamic World</label>
        <select
          className="form-select"
          value={params.dwMode}
          onChange={(e) =>
            onParamsChange({ dwMode: e.target.value as LandCoverParams["dwMode"] })
          }
        >
          <option value="mode">Mode (Paling Sering)</option>
          <option value="hillshade">Hillshade</option>
          <option value="probability">Probability</option>
        </select>
      </div>

      <div className="form-check mb-3">
        <input
          className="form-check-input"
          type="checkbox"
          id="includeImprobableClasses"
          checked={params.includeImprobableClasses}
          onChange={(e) => onParamsChange({ includeImprobableClasses: e.target.checked })}
        />
        <label className="form-check-label" htmlFor="includeImprobableClasses">
          Tampilkan kelas langka/tidak relevan tropis
          <small className="text-muted d-block">
            Contoh: Snow/Ice. Default disembunyikan untuk AOI Indonesia.
          </small>
        </label>
      </div>

      <div className="mb-3">
        <label className="form-label">Rentang Bulan (Dynamic World)</label>
        <div className="d-flex gap-2">
          <select
          className="form-select"
          id="lcStartMonth"
          value={params.startMonth}
            onChange={(e) => onParamsChange({ startMonth: Number(e.target.value) })}
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <span className="align-self-center">s/d</span>
          <select
          className="form-select"
          id="lcEndMonth"
          value={params.endMonth}
            onChange={(e) => onParamsChange({ endMonth: Number(e.target.value) })}
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </div>
        <small className="text-muted">Hanya berlaku untuk Dynamic World</small>
      </div>
    </div>
  );
}
