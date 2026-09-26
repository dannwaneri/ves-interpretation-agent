// One-off: extracts plain text from the three downloaded source PDFs for
// the keyword-search baseline. Paper text itself is gitignored -- only
// this extraction script and the resulting eval infra are committed.
const fs = require('fs')
const path = require('path')
const {PDFParse} = require('pdf-parse')

const FILES = ['bori', 'etche', 'choba']

async function main() {
  for (const name of FILES) {
    const pdfPath = path.join(__dirname, 'paper-text', `${name}.pdf`)
    const buf = fs.readFileSync(pdfPath)
    const parser = new PDFParse({data: buf})
    const result = await parser.getText()
    const outPath = path.join(__dirname, 'paper-text', `${name}.txt`)
    fs.writeFileSync(outPath, result.text)
    console.log(`${name}: ${result.total} pages, ${result.text.length} chars -> ${outPath}`)
  }
}

main()
