import React, {useEffect, useState} from "react";
import {createRoot} from "react-dom/client";
import SegmentationComparison, {type SegmentationResult} from "../../src/features/disaster/components/SegmentationComparison";
import "bootstrap/dist/css/bootstrap.min.css";
import "../../src/styles/legacy-base.css";
import "../../src/styles/app.css";

function Fixture() {
  const [result, setResult] = useState<SegmentationResult>();
  const [error, setError] = useState("");
  useEffect(() => {fetch("/test-results/segmentation/live.json").then(r => r.json()).then(r => setResult(r.statistics.comparison)).catch(e => setError(String(e)));}, []);
  return error ? <div role="alert">{error}</div> : result ? <SegmentationComparison result={result} /> : <p>Memuat hasil model nyata…</p>;
}
createRoot(document.getElementById("root")!).render(<Fixture />);
