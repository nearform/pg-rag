// types/office-to-pdf.d.ts

declare module 'office-to-pdf' {
  function officeToPdf(input: Buffer): Promise<Buffer>
  export default officeToPdf
}
