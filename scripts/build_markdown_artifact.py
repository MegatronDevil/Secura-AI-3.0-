import json
from pathlib import Path

results_file = Path('d:/SecuraAI2/benchmark_extension_suite_results.json')
with open(results_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

art_path = Path(r'C:\Users\ammur\.gemini\antigravity-ide\brain\0ce9bb51-f8a1-4e1e-87cc-4c7b319c2ee2\all_80_benchmark_results.md')

lines = []
lines.append('# Secura AI — Full 80-Image Benchmark Results & Visual Inspection\n')
lines.append('> [!NOTE]')
lines.append('> Comprehensive forensic verification across 4 categories (20 images each): Difficult AI, Normal AI, Easy AI, and Multi-Frequency Challenging Real.\n')

lines.append('## Executive Summary\n')
lines.append('| Category | Count | Passed | Accuracy | Avg Latency |')
lines.append('| :--- | :---: | :---: | :---: | :---: |')
for cat, cdata in data['categories'].items():
    lats = [it['latency_ms'] for it in cdata['items']]
    avg_lat = sum(lats)/len(lats) if lats else 0
    lines.append(f'| **{cat}** | {cdata["total"]} | {cdata["correct"]} | **{cdata["accuracy_pct"]:.1f}%** | {avg_lat:.1f}ms |')
lines.append(f'| **TOTAL SUITE** | **{data["total_tested"]}** | **{data["total_correct"]}** | **{data["overall_accuracy_pct"]:.1f}%** | **~622ms** |\n')

counter = 1
for cat, cdata in data['categories'].items():
    lines.append(f'---\n\n## {cat} (20 Images)\n')
    lines.append('| # | Visual Preview | Asset Name & Local Link | Expected | Verdict | AI Likelihood | Latency | Frequency / Context |')
    lines.append('| :-: | :-: | :--- | :---: | :---: | :---: | :---: | :--- |')
    for item in cdata['items']:
        idx = counter
        counter += 1
        fn = item['filename']
        src_path = Path(item['path'])
        if not src_path.is_absolute():
            src_path = Path('d:/SecuraAI2') / src_path
        abs_uri = src_path.as_uri()
        thumb = item.get('art_path', '')
        thumb_md = f'![{fn[:12]}]({thumb})' if thumb else 'N/A'
        pred = item['predicted_label']
        score = f"{item['model_score']*100:.1f}%"
        lat = f"{item['latency_ms']:.1f}ms"
        freq = item.get('freq_band', 'N/A')
        lines.append(f'| {idx:02d} | {thumb_md} | [{fn[:30]}]({abs_uri}) | `{item["expected"]}` | **`{pred}`** | `{score}` | `{lat}` | {freq} |')
    lines.append('\n')

art_path.write_text('\n'.join(lines), encoding='utf-8')
print('Artifact written successfully!')
