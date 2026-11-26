const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { marked } = require('marked');

// Configure marked options
marked.setOptions({
    gfm: true,
    breaks: true
});

const reportMdPath = path.join(__dirname, '..', 'PROJECT_REPORT.md');
const markdownContent = fs.readFileSync(reportMdPath, 'utf8');

// Convert Markdown to HTML
const bodyHtml = marked(markdownContent);

// Add Academic Styling & Print CSS
const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>FitTrack - Academic Project Report</title>
    <style>
        @page {
            size: A4;
            margin: 22mm 18mm 22mm 18mm;
            @bottom-right {
                content: counter(page);
            }
        }
        *, *::before, *::after {
            box-sizing: border-box;
        }
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #1e293b;
            background: #ffffff;
            margin: 0;
            padding: 0;
        }
        h1, h2, h3, h4, h5, h6 {
            color: #0f172a;
            font-weight: 700;
            page-break-after: avoid;
        }
        h1 {
            font-size: 22pt;
            text-align: center;
            margin-top: 20pt;
            margin-bottom: 8pt;
            color: #0284c7;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        h2 {
            font-size: 14pt;
            border-bottom: 2px solid #0284c7;
            padding-bottom: 4pt;
            margin-top: 22pt;
            margin-bottom: 10pt;
            color: #0369a1;
        }
        h3 {
            font-size: 12pt;
            margin-top: 14pt;
            margin-bottom: 6pt;
            color: #0f172a;
        }
        p {
            margin-top: 0;
            margin-bottom: 10pt;
            text-align: justify;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 14pt 0;
            font-size: 9.5pt;
            page-break-inside: avoid;
        }
        th, td {
            border: 1px solid #cbd5e1;
            padding: 7pt 10pt;
            text-align: left;
        }
        th {
            background-color: #f1f5f9;
            font-weight: 700;
            color: #0f172a;
        }
        tr:nth-child(even) {
            background-color: #f8fafc;
        }
        code {
            font-family: "Courier New", Courier, monospace;
            background: #f1f5f9;
            padding: 2pt 4pt;
            border-radius: 3pt;
            font-size: 9.5pt;
            color: #be185d;
        }
        pre {
            background: #0f172a;
            color: #f8fafc;
            padding: 10pt 14pt;
            border-radius: 6pt;
            font-size: 9pt;
            overflow-x: auto;
            page-break-inside: avoid;
            margin: 12pt 0;
        }
        pre code {
            background: none;
            color: inherit;
            padding: 0;
        }
        blockquote {
            border-left: 4px solid #0284c7;
            margin: 14pt 0;
            padding: 6pt 14pt;
            background: #f0f9ff;
            color: #0369a1;
            font-style: italic;
        }
        hr {
            border: none;
            border-top: 1px solid #e2e8f0;
            margin: 18pt 0;
        }
        ul, ol {
            margin-top: 0;
            margin-bottom: 10pt;
            padding-left: 20pt;
        }
        li {
            margin-bottom: 4pt;
        }
        .page-break {
            page-break-before: always;
        }
    </style>
</head>
<body>
    ${bodyHtml}
</body>
</html>`;

const tempHtmlPath = '/tmp/fittrack_report.html';
fs.writeFileSync(tempHtmlPath, fullHtml);

const outputPdfPath = path.join(__dirname, '..', 'FitTrack_Project_Report.pdf');

console.log('Generating PDF via headless Google Chrome...');
execSync(`google-chrome --headless --disable-gpu --no-pdf-header-footer --print-to-pdf="${outputPdfPath}" "${tempHtmlPath}"`, { stdio: 'inherit' });

console.log('PDF successfully created at:', outputPdfPath);
