const { jsPDF } = require("jspdf");
const { PDFDocument, rgb } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const QRCode = require("qrcode");

// Helper function to read base64 files
const readBase64File = (filename) => {
    try {
        return fs.readFileSync(path.join(__dirname, "images", filename), "utf-8").trim();
    } catch (error) {
        console.error(`Error reading file ${filename}:`, error.message);
        return '';
    }
};

// Helper function to draw a plagiarism circle
const drawPlagiarismCircle = (doc, score, x, y, radius) => {
    const startAngle = -Math.PI / 2;
    const endAngle = startAngle + (2 * Math.PI * (score / 100));

    // Draw background circle
    doc.setDrawColor(200, 200, 200);
    doc.setFillColor(255, 255, 255);
    doc.circle(x, y, radius);

    // Draw score arc
    const segments = 100;
    const angleIncrement = (endAngle - startAngle) / segments;
    let angle = startAngle;

    doc.setDrawColor(255, 87, 34);
    doc.setLineWidth(4);

    for (let i = 0; i < segments; i++) {
        const x1 = x + radius * Math.cos(angle);
        const y1 = y + radius * Math.sin(angle);
        angle += angleIncrement;
        const x2 = x + radius * Math.cos(angle);
        const y2 = y + radius * Math.sin(angle);
        doc.line(x1, y1, x2, y2);
    }

    // Add percentage text
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text(`${score}%`, x - 5, y + 2);
};

// Helper function to add text with a link
const addTextWithLink = (doc, text, linkText, x, y, linkColor, linkUrl, div = 2) => {
    const maxWidth = doc.internal.pageSize.width / div - 30;
    const textLines = doc.splitTextToSize(text, maxWidth);
    doc.setTextColor(0, 0, 0);
    doc.text(textLines, x, y);
    y += textLines.length * 4;
    doc.setTextColor(linkColor);
    doc.textWithLink(linkText, x, y, { url: linkUrl });
    y += 6;
    return y;
};

// Helper function to merge PDFs with or without skipping the first page
const mergePDFs = async (existingDoc, pdfPathToMerge, skipFirstPage = false) => {
    const existingDocBytes = fs.readFileSync(existingDoc);
    const pdfDoc1 = await PDFDocument.load(existingDocBytes);

    const pdfBytes2 = fs.readFileSync(pdfPathToMerge);
    const pdfDoc2 = await PDFDocument.load(pdfBytes2);

    const mergedPdfDoc = await PDFDocument.create();

    // Copy pages from the first PDF
    const pages1 = await mergedPdfDoc.copyPages(pdfDoc1, pdfDoc1.getPageIndices());
    pages1.forEach(page => mergedPdfDoc.addPage(page));

    // Copy pages from the second PDF, optionally skipping the first page
    const pageIndices = skipFirstPage ? pdfDoc2.getPageIndices().slice(1) : pdfDoc2.getPageIndices();
    const pages2 = await mergedPdfDoc.copyPages(pdfDoc2, pageIndices);
    pages2.forEach(page => mergedPdfDoc.addPage(page));

    return mergedPdfDoc;
};

// Helper function to add header, footer, and QR code to a PDF
const addHeaderAndFooterToExistingPDF = async (inputPath, outputPath, headerImagePath, footerImagePath, footerLink, interactivelink) => {
    const existingPdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Add header
    const headerImageBytes = fs.readFileSync(headerImagePath);
    const headerImage = await pdfDoc.embedPng(headerImageBytes);
    const headerImageHeight = 130;

    pdfDoc.getPages().forEach(page => {
        const { width, height } = page.getSize();
        page.drawImage(headerImage, {
            x: 0,
            y: height - headerImageHeight,
            width: width,
            height: headerImageHeight,
        });
    });

    // Add footer
    const footerImageBytes = fs.readFileSync(footerImagePath);
    const footerImage = await pdfDoc.embedPng(footerImageBytes);
    const footerImageHeight = 50;

    pdfDoc.getPages().forEach(page => {
        page.drawImage(footerImage, {
            x: 0,
            y: 0,
            width: 100,
            height: footerImageHeight,
        });
    });

    // Add QR code
    const qrValue = `http://62.72.58.111:4000/user/scanreport/${interactivelink}`;
    const qrCodePath = path.join(__dirname, "qrcode.png");

    await QRCode.toFile(qrCodePath, qrValue, {
        width: 200,
        margin: 2,
        color: { dark: "#000000", light: "#FFFFFF" },
    });

    const qrCodeImageBytes = fs.readFileSync(qrCodePath);
    const qrCodeImage = await pdfDoc.embedPng(qrCodeImageBytes);

    if (pdfDoc.getPages().length > 1) {
        const secondPage = pdfDoc.getPages()[1];
        const { width, height } = secondPage.getSize();

        secondPage.drawImage(qrCodeImage, {
            x: width - 125,
            y: height - headerImageHeight - 405,
            width: 120,
            height: 150,
        });
    }

    // Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, modifiedPdfBytes);
    fs.unlinkSync(qrCodePath); // Clean up QR code file
};

// Function to create the cover page
const coverpage = (data) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const pageHeight = doc.internal.pageSize.height;
    const imageHeight = 45;
    const footerHeight = 10;

    // Add header image
    const headerImageBase64 = readBase64File("banner_base64.txt");
    doc.addImage(headerImageBase64, "PNG", 0, 0, pageWidth, imageHeight);

    // Add footer text and images
    doc.setFontSize(10);
    doc.text("Generated by Your App", pageWidth / 2, pageHeight - footerHeight, { align: "center" });

    const certImage = readBase64File("footerbanner_base64.txt");
    doc.addImage(certImage, "PNG", 0, pageHeight - footerHeight - 5, 50, 15);

    const socialMediaMargin = pageWidth - 60;
    const socialLinks = [
        { file: readBase64File("instagram_icon_base64.txt"), url: "https://www.instagram.com/yourcompany" },
        { file: readBase64File("facebook_icon_base64.txt"), url: "https://www.facebook.com/yourcompany" },
        { file: readBase64File("linkedin_icon_base64.txt"), url: "https://www.linkedin.com/company/yourcompany" },
        { file: readBase64File("twitter_icon_base64.txt"), url: "https://twitter.com/yourcompany" }
    ];

    socialLinks.forEach((item, index) => {
        doc.addImage(item.file, "PNG", socialMediaMargin + index * 15, pageHeight - footerHeight - 5, 10, 10);
        doc.link(socialMediaMargin + index * 15, pageHeight - footerHeight - 10, 10, 10, { url: item.url });
    });

    // Add report title and details
    doc.setFont("times", "bold");
    doc.setFontSize(40);
    doc.setTextColor(0, 102, 204);
    doc.text("Analysis Report", 10, imageHeight + 20);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text("Plagiarism Detection and AI Detection Report", 12, imageHeight + 30);

    doc.setFont("courier", "italic");
    doc.setFontSize(16);
    doc.setTextColor(255, 87, 34);
    doc.text(`${data.scannedDocument.metadata.filename}`, 12, imageHeight + 36);

    // Add scan details
    const scanDetailsY = imageHeight + 30;
    const marginRight = pageWidth - 60;
    doc.setFont("courier", "bold");
    doc.setFontSize(8);
    doc.text("Scan Details", marginRight, scanDetailsY);

    doc.setFont("courier", "normal");
    doc.text("Scan Time:", marginRight, scanDetailsY + 5);
    doc.setFont("courier", "italic");
    doc.text(new Date(data.scannedDocument.creationTime).toLocaleString(), marginRight + 20, scanDetailsY + 5);

    doc.setFont("courier", "normal");
    doc.text("Total Pages:", marginRight, scanDetailsY + 9);
    doc.text("1", marginRight + 20, scanDetailsY + 9);
    doc.text("Total Words:", marginRight, scanDetailsY + 13);
    doc.text(data.scannedDocument.totalWords.toString(), marginRight + 20, scanDetailsY + 13);

    // Add plagiarism score circle
    const sectionsStartY = scanDetailsY + 20;
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("Plagiarism Detection", 25, sectionsStartY);

    const plagiarismScore = data.results.score.aggregatedScore;
    drawPlagiarismCircle(doc, plagiarismScore, 75, sectionsStartY + 40, 25);

    return doc;
};

// Function to create the detailed analysis page
const PlagiarismdetailedAnalysisPage = (doc, data) => {
    doc.addPage();
    const pageWidth = doc.internal.pageSize.width;

    // Add plagiarism header and score circle
    doc.setFont("times", "bold");
    doc.setFontSize(40);
    doc.text("Plagiarism", 20, 20);

    drawPlagiarismCircle(doc, data.results.score.aggregatedScore, 180, 30, 20);

    // Add analytics table
    const analyticsStartY = 70;
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("Analytics", pageWidth / 2 + 10, analyticsStartY);

    doc.setLineWidth(0.5);
    doc.setDrawColor(169, 169, 169);
    doc.line(pageWidth / 2 + 10, analyticsStartY + 5, pageWidth - 30, analyticsStartY + 5);

    const tableStartY = analyticsStartY + 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Plagiarism Types", pageWidth / 2 + 10, tableStartY);
    doc.text("Test Coverage", pageWidth / 2 + 50, tableStartY);
    doc.text("Words", pageWidth / 2 + 80, tableStartY);

    doc.line(pageWidth / 2 + 10, tableStartY + 5, pageWidth - 30, tableStartY + 5);

    let currentY = tableStartY + 15;
    const plagiarismTypes = [
        { label: "Identical Insights", color: [255, 0, 0], words: data.results.score.identicalWords },
        { label: "Minor Changes", color: [255, 102, 102], words: data.results.score.minorChangedWords },
        { label: "Paraphrased", color: [255, 165, 0], words: data.results.score.relatedMeaningWords }
    ];

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    plagiarismTypes.forEach(type => {
        doc.setFillColor(...type.color);
        doc.circle(pageWidth / 2 + 10, currentY - 1.5, 1.5, "F");
        doc.text(type.label, pageWidth / 2 + 13, currentY);
        doc.text("0%", pageWidth / 2 + 55, currentY);
        doc.text(`${type.words}`, pageWidth / 2 + 85, currentY);
        currentY += 5;
    });

    return doc;
};

// Function to create the AI analysis page
const AiAnalysisPage = (aidata, aivalueData) => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;

    // Add AI header and score circle
    doc.setFont("times", "bold");
    doc.setFontSize(40);
    doc.text("AI Content", 20, 20);

    drawPlagiarismCircle(doc, 100, 180, 30, 20);

    // Add analytics table
    const analyticsStartY = 70;
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("Analytics", pageWidth / 2 + 10, analyticsStartY);

    doc.setLineWidth(0.5);
    doc.setDrawColor(169, 169, 169);
    doc.line(pageWidth / 2 + 10, analyticsStartY + 5, pageWidth - 30, analyticsStartY + 5);

    const tableStartY = analyticsStartY + 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("AI Text", pageWidth / 2 + 10, tableStartY);
    doc.text("Test Coverage", pageWidth / 2 + 50, tableStartY);
    doc.text("Words", pageWidth / 2 + 80, tableStartY);

    doc.line(pageWidth / 2 + 10, tableStartY + 5, pageWidth - 30, tableStartY + 5);

    let currentY = tableStartY + 15;
    const aiStats = aidata.explain.patterns.statistics;
    const aiWords = aidata.explain.patterns.text.words;

    const aiPercentage = (aiWords.lengths.reduce((sum, length) => sum + length, 0) / aidata.results[0].matches[0].text.words.lengths[0]) * 100;
    const humanPercentage = 100 - aiPercentage;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setFillColor(204, 153, 255);
    doc.circle(pageWidth / 2 + 10, currentY - 1.5, 1.5, "F");
    doc.text("AI Text", pageWidth / 2 + 13, currentY);
    doc.text(`${aiPercentage.toFixed(2)}%`, pageWidth / 2 + 55, currentY);
    doc.text(`${aiWords.lengths.reduce((sum, length) => sum + length, 0)}`, pageWidth / 2 + 85, currentY);

    currentY += 5;
    doc.setFillColor(211, 211, 211);
    doc.circle(pageWidth / 2 + 10, currentY - 1.5, 1.5, "F");
    doc.text("Human Text", pageWidth / 2 + 13, currentY);
    doc.text(`${humanPercentage.toFixed(2)}%`, pageWidth / 2 + 55, currentY);
    doc.text(`${aidata.results[0].matches[0].text.words.lengths[0] - aiWords.lengths.reduce((sum, length) => sum + length, 0)}`, pageWidth / 2 + 85, currentY);

    return doc;
};

module.exports = {
    mergePDFs,
    addHeaderAndFooterToExistingPDF,
    coverpage,
    PlagiarismdetailedAnalysisPage,
    AiAnalysisPage,
};