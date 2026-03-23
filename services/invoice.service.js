const fs = require("fs");
const path = require("path");
const PDFDocument = require("pdfkit");

/* ================= GENERATE INVOICE ================= */
async function generateInvoice({ 
  invoiceNo,
  studentName,
  email,
  courseName,
  amount,
  orderId
}) {
  return new Promise((resolve, reject) => {
    try {
      const invoicesDir = path.join(__dirname, "../invoices");
      if (!fs.existsSync(invoicesDir)) {
        fs.mkdirSync(invoicesDir);
      }

      const fileName = `invoice-${invoiceNo}.pdf`;
      const filePath = path.join(invoicesDir, fileName);

      const doc = new PDFDocument({ size: "A4", margin: 50 });
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Header
      doc
        .fontSize(24)
        .text("EduNexa", { align: "center" })
        .moveDown(0.5);

      doc
        .fontSize(12)
        .text("Learn. Certify. Grow.", { align: "center" })
        .moveDown(2);

      // Invoice Info
      doc.fontSize(14).text(`Invoice No: ${invoiceNo}`);
      doc.text(`Order ID: ${orderId}`);
      doc.text(`Date: ${new Date().toLocaleDateString()}`);
      doc.moveDown();

      // Customer
      doc.fontSize(14).text("Billed To:");
      doc.fontSize(12).text(studentName);
      doc.text(email);
      doc.moveDown();

      // Course Table
      doc.fontSize(14).text("Course Details:");
      doc.moveDown(0.5);

      doc.fontSize(12).text(`Course: ${courseName}`);
      doc.text(`Amount Paid: ₹ ${amount}`);
      doc.moveDown(2);

      // Footer
      doc
        .fontSize(12)
        .text("Thank you for learning with EduNexa!", { align: "center" });

      doc.end();

      stream.on("finish", () => {
        resolve({
          filePath,
          fileName
        });
      });

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = { generateInvoice };
