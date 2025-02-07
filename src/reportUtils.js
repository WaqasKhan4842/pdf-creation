const { jsPDF } = require("jspdf");
const { PDFDocument, rgb, PDFName } = require('pdf-lib');
const fs = require('fs');
const path = require('path');
const QRCode = require("qrcode");




/**
 * Draws a circular plagiarism score indicator on a PDF.
 * @param {Object} doc - The jsPDF document instance.
 * @param {number} score - The plagiarism score percentage (0-100).
 * @param {number} x - X-coordinate for the circle center.
 * @param {number} y - Y-coordinate for the circle center.
 * @param {number} radius - Radius of the circle.
 */

function drawPlagiarismCircle(doc, score, x, y, radius) {
    const startAngle = -Math.PI / 2; // Start from the top (12 o'clock position)
    const endAngle = startAngle + (2 * Math.PI * (score / 100)); // Calculate the angle based on the score

    // Draw a light gray background circle to represent 100% plagiarism
    doc.setDrawColor(200, 200, 200); // Light gray color
    doc.setFillColor(255, 255, 255); // White background
    doc.circle(x, y, radius); // Draw the full circle

    // Draw the plagiarism score arc (orange segment)
    const segments = 100; // More segments = smoother arc
    const angleIncrement = (endAngle - startAngle) / segments; // Split arc into small lines
    let angle = startAngle;

    doc.setDrawColor(255, 87, 34); // Orange color for the score arc
    doc.setLineWidth(4); // Make the arc a bit bold

    for (let i = 0; i < segments; i++) {
        const x1 = x + radius * Math.cos(angle);
        const y1 = y + radius * Math.sin(angle);
        angle += angleIncrement;
        const x2 = x + radius * Math.cos(angle);
        const y2 = y + radius * Math.sin(angle);
        doc.line(x1, y1, x2, y2); // Draw each tiny segment of the arc
    }

    // Display the percentage inside the circle
    doc.setFont("times", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0); // Black color
    doc.text(`${score}%`, x - 5, y + 2); // Center the text
}

/**
 * Adds text to a PDF with a clickable hyperlink.
 * @param {Object} doc - The jsPDF document instance.
 * @param {string} text - The main content to display.
 * @param {string} linkText - The clickable text for the hyperlink.
 * @param {number} x - X position to start the text.
 * @param {number} y - Y position to start the text.
 * @param {Array} linkColor - RGB color array for the link text.
 * @param {string} linkUrl - The URL for the hyperlink.
 * @param {number} [div=2] - Factor to control text width (default: 2 for half-page width).
 * @returns {number} - Updated Y position after adding the text.
 */


const addTextWithLink = (doc, text, linkText, x, y, linkColor, linkUrl, div = 2) => {
    const maxWidth = doc.internal.pageSize.width / div - 30; // Ensures the text doesn't go off-page
    const textLines = doc.splitTextToSize(text, maxWidth); // Break text into multiple lines if needed

    // Add the main text in black
    doc.setTextColor(0, 0, 0);
    doc.text(textLines, x, y);

    // Move the Y position down for the hyperlink
    y += textLines.length * 4;

    // Add the hyperlink in blue
    doc.setTextColor(173, 216, 230); // Light blue for links
    doc.textWithLink(linkText, x, y, { url: linkUrl });

    // Move Y down a bit to ensure spacing after the link
    y += 6;

    return y;
};


/**
 * Merges two PDFs into one.
 * @param {string} existingDocPath - Path to the first PDF.
 * @param {string} pdfToMergePath - Path to the second PDF.
 * @param {boolean} skipFirstPage - Whether to skip the first page of the second PDF.
 * @returns {Promise<PDFDocument>} - The merged PDF document.
 */

const mergePDFs = async (existingDocPath, pdfToMergePath, skipFirstPage = false) => {
    try {
        // Load the first PDF
        const existingDocBytes = fs.readFileSync(existingDocPath);
        const pdfDoc1 = await PDFDocument.load(existingDocBytes);

        // Load the second PDF
        const pdfBytes2 = fs.readFileSync(pdfToMergePath);
        const pdfDoc2 = await PDFDocument.load(pdfBytes2);

        // Create a new PDF document for the merged result
        const mergedPdfDoc = await PDFDocument.create();

        // Copy all pages from the first PDF
        const pages1 = await mergedPdfDoc.copyPages(pdfDoc1, pdfDoc1.getPageIndices());
        pages1.forEach(page => mergedPdfDoc.addPage(page));

        // Copy pages from the second PDF, optionally skipping the first page
        const pageIndices = skipFirstPage ? pdfDoc2.getPageIndices().slice(1) : pdfDoc2.getPageIndices();
        const pages2 = await mergedPdfDoc.copyPages(pdfDoc2, pageIndices);
        pages2.forEach(page => mergedPdfDoc.addPage(page));

        return mergedPdfDoc;
    } catch (error) {
        console.error("Error merging PDFs:", error);
        throw new Error("Failed to merge PDFs");
    }
};

/**
 * Adds a header, footer, and a QR code to an existing PDF.
 * @param {string} inputPath - Path to the existing PDF file.
 * @param {string} outputPath - Path to save the modified PDF.
 * @param {string} headerImagePath - Path to the header image.
 * @param {string} footerImagePath - Path to the footer image.
 * @param {string} footerLink - URL associated with the footer (not used in this version).
 * @param {string} interactivelink - Dynamic value for generating the QR code.
 */



const addHeaderAndFooterToExistingPDF = async (
    inputPath,
    outputPath,
    headerImagePath,
    footerImagePath,
    footerLink,
    interactivelink
) => {
    // Step 1: Load the existing PDF
    const existingPdfBytes = fs.readFileSync(inputPath);
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Step 2: Load the header image
    const headerImageBytes = fs.readFileSync(headerImagePath);
    const headerImage = await pdfDoc.embedPng(headerImageBytes);
    const headerImageWidth = pdfDoc.getPage(0).getWidth(); // Full width
    const headerImageHeight = 130; // Fixed height for header

    // Step 3: Add the header to each page
    const pages = pdfDoc.getPages();
    pages.forEach((page) => {
        const { height } = page.getSize();
        page.drawImage(headerImage, {
            x: 0, // Start from the left
            y: height - headerImageHeight, // Position at the top
            width: headerImageWidth,
            height: headerImageHeight,
        });
    });

    // Step 4: Load the footer image
    const footerImageBytes = fs.readFileSync(footerImagePath);
    const footerImage = await pdfDoc.embedPng(footerImageBytes);
    const footerImageWidth = 100; // Fixed width for footer
    const footerImageHeight = 50; // Fixed height for footer

    // Step 5: Add the footer to each page
    pages.forEach((page) => {
        page.drawImage(footerImage, {
            x: 0, // Start from the left
            y: 0, // Position at the bottom
            width: footerImageWidth,
            height: footerImageHeight,
        });
    });

    // Step 6: Generate a QR Code with the given interactive link
    const qrValue = `http://62.72.58.111:4000/user/scanreport/${interactivelink}`; // URL to encode in QR code
    const qrCodePath = path.join(__dirname, "qrcode.png"); // Temporary QR code file path

    // Generate the QR code and save it as a PNG
    await QRCode.toFile(qrCodePath, qrValue, {
        width: 200, // Define QR code size
        margin: 2, // Small margin
        color: {
            dark: "#000000", // Black for QR code
            light: "#FFFFFF", // White background
        },
    });

    // Step 7: Load the QR code into the PDF
    const qrCodeImageBytes = fs.readFileSync(qrCodePath);
    const qrCodeImage = await pdfDoc.embedPng(qrCodeImageBytes);
    const qrCodeWidth = 120; // Set QR code width
    const qrCodeHeight = 150; // Set QR code height

    // Step 8: Add the QR code to the second page only (if available)
    if (pages.length > 1) {
        const secondPage = pages[1]; // Get second page
        const { width, height } = secondPage.getSize();

        // Position the QR code in the top-right corner
        const qrCodeX = width - qrCodeWidth - 5; // Right margin
        const qrCodeY = height - headerImageHeight - qrCodeHeight - 405; // Adjust height

        // Draw a white background rectangle behind the QR code (optional)
        secondPage.drawRectangle({
            x: qrCodeX,
            y: qrCodeY,
            width: qrCodeWidth,
            height: qrCodeHeight,
            color: rgb(1, 1, 1), // White background
            borderColor: rgb(0, 0, 0), // Black border (optional)
            borderWidth: 1, // Thin border
        });

        // Draw the QR code on top of the rectangle
        secondPage.drawImage(qrCodeImage, {
            x: qrCodeX,
            y: qrCodeY,
            width: qrCodeWidth,
            height: qrCodeHeight,
        });
    }

    // Step 9: Save the modified PDF
    const modifiedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(outputPath, modifiedPdfBytes);
    console.log(`Header, Footer, and QR Code added. Saved as: ${outputPath}`);

    // Step 10: Delete the temporary QR code file
    fs.unlinkSync(qrCodePath);
};

/**
 * Generates a cover page for a report with custom header, footer, and social media links.
 * @param {Object} data - The data used to populate the report.
 * @param {Object} data.scannedDocument - The scanned document information.
 * @param {string} data.scannedDocument.metadata.filename - The name of the scanned file.
 * @param {number} data.scannedDocument.creationTime - The timestamp when the document was scanned.
 * @param {number} data.scannedDocument.totalWords - The total word count of the scanned document.
 * @param {number} data.scannedDocument.totalExcluded - The number of omitted words during the plagiarism scan.
 * @param {Object} data.results.score - The plagiarism score data.
 * @param {number} data.results.score.aggregatedScore - The aggregated plagiarism score.
 * @param {number} data.results.score.identicalWords - The number of identical words found.
 * @param {number} data.results.score.minorChangedWords - The number of minor changed words found.
 * @param {number} data.results.score.relatedMeaningWords - The number of paraphrased words found.
 * @returns {jsPDF} - The jsPDF document object with the cover page added.
 */
const coverpage = (data) => {
    const doc = new jsPDF(); // Create a new jsPDF instance for the document
    const pageWidth = doc.internal.pageSize.width; // Get the width of the page
    const pageHeight = doc.internal.pageSize.height; // Get the height of the page
    const imageHeight = 45; // Height for the header image
    const footerHeight = 10; // Height for the footer

    /**
     * Reads a Base64 encoded file and returns its content.
     * @param {string} filename - The name of the file to read.
     * @returns {string} - The Base64 content of the file.
     */
    const readBase64File = (filename) => {
        try {
            // Read the file content and trim extra whitespace
            return fs.readFileSync(path.join(__dirname, "images", filename), "utf-8").trim();
        } catch (error) {
            console.error(`Error reading file ${filename}:`, error.message);
            return ''; // Return empty string in case of error
        }
    };

    // Reading images in Base64 format
    const headerImageBase64 = readBase64File("banner_base64.txt");
    console.log("Header Image Loaded");
    const certImage = readBase64File("footerbanner_base64.txt");
    console.log("Footer Image Loaded");
    const instagramIcon = readBase64File("instagram_icon_base64.txt");
    console.log("Instagram Icon Loaded");
    const facebookIcon = readBase64File("facebook_icon_base64.txt");
    console.log("Facebook Icon Loaded");
    const linkedinIcon = readBase64File("linkedin_icon_base64.txt");
    console.log("LinkedIn Icon Loaded");
    const twitterIcon = readBase64File("twitter_icon_base64.txt");
    console.log("Twitter Icon Loaded");

    // Add the header image to the document
    doc.addImage(headerImageBase64, "PNG", 0, 0, pageWidth, imageHeight);
    console.log("Added Header Image to the Document");

    // Add a footer text to the document
    doc.setFontSize(10);
    doc.text("Generated by Your App", pageWidth / 2, pageHeight - footerHeight, { align: "center" });

    // Add the certificate image to the footer
    doc.addImage(certImage, "PNG", 0, pageHeight - footerHeight - 5, 50, 15);
    console.log("Added Certificate Image to the Document");

    // Add the certificate text to the footer
    doc.setFontSize(16);
    doc.setFont("times", "bold");
    doc.setTextColor(169, 169, 169); // Gray color
    doc.text("Certified by", 5, pageHeight - footerHeight - 10);

    // Define social media links and icons
    const socialMediaMargin = pageWidth - 60;
    const socialLinks = [
        { file: instagramIcon, url: "https://www.instagram.com/yourcompany" },
        { file: facebookIcon, url: "https://www.facebook.com/yourcompany" },
        { file: linkedinIcon, url: "https://www.linkedin.com/company/yourcompany" },
        { file: twitterIcon, url: "https://twitter.com/yourcompany" }
    ];

    // Loop through the social media icons and add them to the footer
    socialLinks.forEach((item, index) => {
        const icon = item.file;
        console.log(`Added ${item.url} Icon`);
        doc.addImage(icon, "PNG", socialMediaMargin + index * 15, pageHeight - footerHeight - 5, 10, 10);
        doc.link(socialMediaMargin + index * 15, pageHeight - footerHeight - 10, 10, 10, { url: item.url });
    });

    // Add the title "Analysis Report" to the cover page
    doc.setFont("times", "bold");
    doc.setFontSize(40);
    doc.setTextColor(0, 102, 204); // Blue color
    doc.text("Analysis Report", 10, imageHeight + 20);

    // Add subtitle "Plagiarism Detection and AI Detection Report"
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0); // Black color
    doc.text("Plagiarism Detection and AI Detection Report", 12, imageHeight + 30);

    // Add the filename from the scanned document metadata
    doc.setFont("courier", "italic");
    doc.setFontSize(16);
    doc.setTextColor(255, 87, 34); // Orange color
    doc.text(`${data.scannedDocument.metadata.filename}`, 12, imageHeight + 36);

    // Add scan details to the cover page
    const scanDetailsY = imageHeight + 30;
    const marginRight = pageWidth - 60;
    doc.setFont("courier", "bold");
    doc.setFontSize(8);
    doc.setTextColor(0); // Black color
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

    // Add sections to the cover page
    const sectionsStartY = scanDetailsY + 20;
    doc.setFont("times", "bold");
    doc.setFontSize(16);
    doc.text("Plagiarism Detection", 25, sectionsStartY);

    // Draw the plagiarism circle based on score
    const plagiarismScore = data.results.score.aggregatedScore;
    drawPlagiarismCircle(doc, plagiarismScore, 75, sectionsStartY + 40, 25);

    // Add analytics section header
    const analyticsStartY = sectionsStartY + 80;
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("Analytics", 25, analyticsStartY);
    doc.setLineWidth(0.5);
    doc.setDrawColor(169, 169, 169); // Gray color
    doc.line(25, analyticsStartY + 5, pageWidth / 2 - 10, analyticsStartY + 5);

    // Add table headers for plagiarism types
    const tableStartY = analyticsStartY + 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Plagiarism Types", 25, tableStartY);
    doc.text("Test Coverage", 65, tableStartY);
    doc.text("Words", 95, tableStartY);
    doc.line(25, tableStartY + 5, pageWidth / 2 - 10, tableStartY + 5);

    // Add the plagiarism types data to the table
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
        doc.circle(25, currentY - 1.5, 1.5, "F");
        doc.text(type.label, 28, currentY);
        doc.text(type.words.toString(), 95, currentY);
        currentY += 10;
    });

    return doc; // Return the generated jsPDF document
};


// Function to create the detailed analysis page
const PlagiarismdetailedAnalysisPage = (doc, data) => {
    // Add a new page
    doc.addPage();

    // Add the "Plagiarism" header
    doc.setFont("times", "bold"); // Times font, bold
    doc.setFontSize(40); // Increase the font size
    doc.text("Plagiarism", 20, 20); // Text at the top left

    // Add a circle with the plagiarism score
    const circleX = 180; // X-coordinate for the circle
    const circleY = 30; // Y-coordinate for the circle
    const radius = 20; // Radius of the circle
    drawPlagiarismCircle(doc, data.results.score.aggregatedScore, circleX, circleY, radius);

    // Add "Result (0)" above the first row of images
    const resultText = "Result (0)";
    doc.setFontSize(12);
    doc.text(resultText, doc.internal.pageSize.width / 8, circleY + radius + 10, { align: "center" });

    // Define constants for image placement
    const pageWidth = doc.internal.pageSize.width;
    const imageWidth = 10; // Width of each image
    const imageHeight = 10; // Height of each image
    const columnSpacing = 25; // Space between images in a row
    const rowSpacing = 20; // Space between rows
    const offsetLeft = 50; // Adjust to move images to the left
    const imageYStart = circleY + radius + 20; // Start Y-coordinate for the images

    // Image file data
    const images = [
        {
            base64: fs.readFileSync(path.join(__dirname, "images", "database_base64.txt"), "utf-8").trim(),

            heading: "Repository",
        },
        {
            base64: fs.readFileSync(path.join(__dirname, "images", "internal_database_base64.txt"), "utf-8").trim(),

            // fs.readFileSync("images/internal_database_base64.txt", "utf-8").trim(),
            heading: "Internal Database",
        },
        {
            base64: fs.readFileSync(path.join(__dirname, "images", "filter_base64.txt"), "utf-8").trim(),
            // fs.readFileSync("images/filter_base64.txt", "utf-8").trim(),
            heading: "Filtered/Excluded",
        },
        {
            base64: fs.readFileSync(path.join(__dirname, "images", "internet_base64.txt"), "utf-8").trim(),
            // fs.readFileSync("images/internet_base64.txt", "utf-8").trim(),
            heading: "Internet Sources",
        },
        {
            base64: fs.readFileSync(path.join(__dirname, "images", "batch_base64.txt"), "utf-8").trim(),
            // fs.readFileSync("images/batch_base64.txt", "utf-8").trim(),
            heading: "Current Batch",
        },
    ];

    // Center-align first row (3 images) and shift left
    let x = (pageWidth - (3 * imageWidth + 2 * columnSpacing)) / 2 - offsetLeft;
    let y = imageYStart;

    for (let i = 0; i < 3; i++) {
        const img = images[i];
        doc.addImage(img.base64, "PNG", x, y, imageWidth, imageHeight);
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.text(img.heading, x + imageWidth / 2, y + imageHeight + 5, { align: "center" });
        doc.text("0", x + imageWidth / 2, y + imageHeight + 10, { align: "center" });
        x += imageWidth + columnSpacing; // Move to the next image
    }

    // Center-align second row (2 images) and shift left
    x = (pageWidth - (2 * imageWidth + columnSpacing)) / 2 - offsetLeft;
    y += imageHeight + rowSpacing; // Move to the next row

    for (let i = 3; i < 5; i++) {
        const img = images[i];
        doc.addImage(img.base64, "PNG", x, y, imageWidth, imageHeight);
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        doc.text(img.heading, x + imageWidth / 2, y + imageHeight + 5, { align: "center" });
        doc.text("0", x + imageWidth / 2, y + imageHeight + 10, { align: "center" });
        x += imageWidth + columnSpacing; // Move to the next image
    }

    // Add plagiarism analytics after the circle
    const plagiarismSectionX = pageWidth / 2 + 10; // Adjust to position on the right half
    const plagiarismSectionWidth = pageWidth / 2 - 20; // Width of the plagiarism section
    const analyticsStartY = circleY + radius + 20;

    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("Analytics", plagiarismSectionX, analyticsStartY);

    // Add a gray line under the title
    doc.setLineWidth(0.5);
    doc.setDrawColor(169, 169, 169);
    doc.line(plagiarismSectionX, analyticsStartY + 5, plagiarismSectionX + plagiarismSectionWidth - 10, analyticsStartY + 5);

    // Add table headers
    const tableStartY = analyticsStartY + 15;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.text("Plagiarism Types", plagiarismSectionX, tableStartY);
    doc.text("Test Coverage", plagiarismSectionX + 40, tableStartY);
    doc.text("Words", plagiarismSectionX + 70, tableStartY);

    // Add a gray line under the headers
    doc.line(plagiarismSectionX, tableStartY + 5, plagiarismSectionX + plagiarismSectionWidth - 10, tableStartY + 5);

    // Add rows for analytics
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    let currentY = tableStartY + 15;



    // Row 1: Identical Insights
    doc.setFillColor(255, 0, 0);
    doc.circle(plagiarismSectionX, currentY - 1.5, 1.5, "F");
    doc.text("Identical Insights", plagiarismSectionX + 3, currentY);
    doc.text("100%", plagiarismSectionX + 45, currentY);
    doc.text(`${data.results.score.identicalWords}`, plagiarismSectionX + 70, currentY);

    // Row 2: Minor Changes
    currentY += 5;
    doc.setFillColor(255, 102, 102);
    doc.circle(plagiarismSectionX, currentY - 1.5, 1.5, "F");
    doc.text("Minor Changes", plagiarismSectionX + 3, currentY);
    doc.text("0%", plagiarismSectionX + 45, currentY);
    doc.text(`${data.results.score.minorChangedWords}`, plagiarismSectionX + 70, currentY);

    // Row 3: Paraphrased
    currentY += 5;
    doc.setFillColor(255, 165, 0);
    doc.circle(plagiarismSectionX, currentY - 1.5, 1.5, "F");
    doc.text("Paraphrased", plagiarismSectionX + 3, currentY);
    doc.text("0%", plagiarismSectionX + 45, currentY);
    doc.text(`${data.results.score.relatedMeaningWords}`, plagiarismSectionX + 70, currentY);

    // Add a gray line after the rows
    currentY += 5;
    doc.line(plagiarismSectionX, currentY, plagiarismSectionX + plagiarismSectionWidth - 10, currentY);
    currentY += 5;
    // Lighter blue color for the circle
    doc.setFillColor(173, 216, 230); // Light blue color for the fill
    doc.circle(plagiarismSectionX, currentY - 1.5, 1.5, "F"); // Filled circle

    // Dotted outline for the circle
    doc.setLineWidth(0.5); // Thin line for the outline
    doc.setDrawColor(173, 216, 230); // Same light blue for the outline
    doc.circle(plagiarismSectionX, currentY - 1.5, 1.5, "D"); // Dotted circle outlin
    doc.text("Ommitted Words", plagiarismSectionX + 3, currentY);
    doc.text("0%", plagiarismSectionX + 45, currentY);
    doc.text(`${data.results.score.relatedMeaningWords}`, plagiarismSectionX + 70, currentY);

    // Add excluded words
    // Adjust sectionStartY based on the current content position
    const sectionStartY = currentY + 20;

    // Define the page margins and maximum text width
    const marginLeft = 10;
    const marginRight = 20;
    let maxTextWidth = doc.internal.pageSize.width - marginLeft - marginRight;

    // Add the heading
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text(
        "About Our Plagiarism Detection",
        marginLeft,
        sectionStartY
    );

    // Add the body text with wrapping
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    const bodyText =
        "Our AI-powered plagiarism scans offer three layers of text similarity detection: Identical, Minor Changes, and Paraphrased. Based on your scan settings, we also provide insights on how much of the text you are not scanning for plagiarism (Omitted words).";
    const wrappedText = doc.splitTextToSize(bodyText, maxTextWidth);
    doc.text(wrappedText, marginLeft, sectionStartY + 5);


    // Define constants for the rows
    // Constants for layout
    const colSpacing = 20; // Adjust column spacing
    const leftColX = 15; // Left column X position
    const rightColX = doc.internal.pageSize.width / 2 + 5; // Right column X position

    // First row
    let rowY = sectionStartY + 25; // Initial row Y position

    // Left: Identical
    doc.setFillColor(255, 0, 0); // Red color
    doc.circle(leftColX, rowY - 3, 3, "F");
    doc.setFont("times", "bold");
    doc.text("Identical", leftColX + 5, rowY - 3);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    rowY = addTextWithLink(
        doc,
        "One-to-one exact word matches.",
        "Learn more",
        leftColX,
        rowY + 5,
        "lightblue",
        "https://example.com/identical"
    );

    // Right: Minor Changes
    doc.setTextColor(0, 0, 0); // Reset text color
    let minorChangesY = sectionStartY + 23; // Ensure alignment with Identical
    doc.setFillColor(255, 102, 102); // Light red color
    doc.circle(rightColX, minorChangesY - 3, 3, "F");
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text("Minor Changes", rightColX + 5, minorChangesY - 2);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    minorChangesY = addTextWithLink(
        doc,
        "Words that hold nearly the same meaning but have a change of their form (e.g., 'large' becomes 'largely').",
        "Learn more",
        rightColX,
        minorChangesY + 5,
        "lightblue",
        "https://example.com/minor-changes"
    );

    // Second row
    rowY = Math.max(rowY, minorChangesY) + colSpacing - 10; // Ensure proper alignment for the second row

    // Left: Paraphrased
    doc.setTextColor(0, 0, 0); // Reset text color
    doc.setFillColor(255, 165, 0); // Orange color
    doc.circle(leftColX, rowY - 3, 3, "F");
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text("Paraphrased", leftColX + 5, rowY - 2);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    rowY = addTextWithLink(
        doc,
        "Different words that hold the same meaning that replace the original content (e.g., 'large' becomes 'big').",
        "Learn more",
        leftColX,
        rowY + 5,
        "lightblue",
        "https://example.com/paraphrased"
    );

    // Right: Omitted Words
    doc.setTextColor(0, 0, 0); // Reset text color
    doc.setLineWidth(0.5);
    doc.setDrawColor(0, 0, 255); // Blue color
    doc.circle(rightColX, rowY - 24, 3, "D"); // Dotted circle
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text("Omitted Words", rightColX + 5, rowY - 23);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    rowY = addTextWithLink(
        doc,
        "The portion of text not being scanned for plagiarism based on the scan settings (e.g., the 'ignore quotation' setting is enabled, and the document is 20% quotation, making the omitted words percentage 20%).",
        "Learn more",
        rightColX,
        rowY - 15,
        "lightblue",
        "https://example.com/omitted-words"
    );

    // Continuing from previous code...

    rowY += 2; // Spacing for the next section
    doc.setDrawColor(192); // Set gray color for the line
    doc.setLineWidth(0.5); // Set thin line width
    doc.line(10, rowY, doc.internal.pageSize.width - 10, rowY); // Draw a horizontal line across the page

    // Copyleaks Internal Database
    rowY += 5; // Spacing for the next section
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0); // Reset text color
    doc.text("Skyline Academics Internal Database", 10, rowY); // Use full page width
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    rowY = addTextWithLink(
        doc,
        "Our Internal Database is a collection of millions of user-submitted documents that you can utilize as a scan resource and choose whether or not you would like to submit the file you are scanning into the Internal Database.",
        "Learn more",
        10, // Start at the left edge of the page
        rowY + 5,
        "lightblue",
        "https://example.com/copyleaks-internal-database",
        1
    );

    // Filtered and Excluded Results
    rowY += 2; // Spacing for the next section
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0); // Reset text color
    doc.text("Filtered and Excluded Results", 10, rowY); // Use full page width
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    rowY = addTextWithLink(
        doc,
        "The report will generate a complete list of results. There is always the option to exclude specific results that are not relevant. Note, by unchecking certain results, the similarity percentage may change.",
        "Learn more",
        10, // Start at the left edge
        rowY + 5,
        "lightblue",
        "https://example.com/filtered-excluded-results",
        1
    );

    // Current Batch Results
    rowY += 2; // Spacing for the next section
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0); // Reset text color
    doc.text("Current Batch Results", 10, rowY); // Use full page width
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    rowY = addTextWithLink(
        doc,
        "These are the results displayed from the collection, or batch, of files uploaded for a scan at the same time.",
        "Learn more",
        10, // Start at the left edge
        rowY + 5,
        "lightblue",
        "https://example.com/current-batch-results",
        1
    );

    // Reset text color
    doc.setTextColor(0, 0, 0); // Reset text color to black

    const pageHeight = doc.internal.pageSize.height;
    const footerHeight = 10; // Space for the footer

    // // Add the text in the footer center
    doc.setFontSize(10);
    doc.text("Generated by Your App", pageWidth / 2, pageHeight - footerHeight, { align: "center" });

    // Add certification image on the left with "Certified by"
    const certImage = fs.readFileSync(path.join(__dirname, "images/footerbanner_base64.txt"), "utf-8").trim();
    const certImageWidth = 50; // Width of the certification image
    const certImageHeight = 15; // Height of the certification image

    // Add certification image
    doc.addImage(certImage, "PNG", 0, pageHeight - footerHeight - 5, certImageWidth, certImageHeight); // Adjust the position




    // Function to add social media icons to the footer
    const addSocialMediaIcons = (doc, pageWidth, pageHeight, footerHeight) => {
        const socialMediaMargin = pageWidth - 60; // Start the icons 60 units from the right

        // Define social media links and icon paths
        const socialMediaData = [
            { iconPath: "images/instagram_icon_base64.txt", url: "https://www.instagram.com/yourcompany", xOffset: 0 },
            { iconPath: "images/facebook_icon_base64.txt", url: "https://www.facebook.com/yourcompany", xOffset: 15 },
            { iconPath: "images/linkedin_icon_base64.txt", url: "https://www.linkedin.com/company/yourcompany", xOffset: 30 },
            { iconPath: "images/twitter_icon_base64.txt", url: "https://twitter.com/yourcompany", xOffset: 45 }
        ];

        // Loop through the social media data and add icons
        socialMediaData.forEach((socialMedia) => {
            const iconBase64 = fs.readFileSync(path.join(__dirname, socialMedia.iconPath), "utf-8").trim();
            const xPosition = socialMediaMargin + socialMedia.xOffset;
            const yPosition = pageHeight - footerHeight - 5;
            const iconSize = 10;

            doc.addImage(iconBase64, "PNG", xPosition, yPosition, iconSize, iconSize);
            doc.link(xPosition, pageHeight - footerHeight - 10, iconSize, iconSize, { url: socialMedia.url });
        });
    };

    // Call the function
    addSocialMediaIcons(doc, pageWidth, pageHeight, footerHeight);





    return doc;
}



// Function to create the detailed analysis page
const AiAnalysisPage = (aidata, aivalueData) => {

    const doc = new jsPDF();
    // const pageWidth = doc.internal.pageSize.width; // Width of the page
    // Add a new page
    // doc.addPage();

    // Add the "Plagiarism" header
    doc.setFont("times", "bold"); // Times font, bold
    doc.setFontSize(40); // Increase the font size
    doc.text("AI Content", 20, 20); // Text at the top left

    // Add a circle with the plagiarism score
    const circleX = 180; // X-coordinate for the circle
    const circleY = 30; // Y-coordinate for the circle
    const radius = 20; // Radius of the circle
    drawPlagiarismCircle(doc, 100, circleX, circleY, radius);


    // Define constants for image placement
    const pageWidth = doc.internal.pageSize.width;
    const imageWidth = 10; // Width of each image
    const imageHeight = 10; // Height of each image
    const columnSpacing = 25; // Space between images in a row
    const rowSpacing = 20; // Space between rows
    const offsetLeft = 50; // Adjust to move images to the left
    const imageYStart = circleY + radius + 20; // Start Y-coordinate for the images



    // Add plagiarism analytics after the circle
    const plagiarismSectionX = pageWidth / 2 + 10; // Adjust to position on the right half
    const plagiarismSectionWidth = pageWidth / 2 - 20; // Width of the plagiarism section
    const analyticsStartY = circleY + radius + 20;

    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("Analytics", plagiarismSectionX, analyticsStartY);

    // // Add a gray line under the title
    doc.setLineWidth(0.5);
    doc.setDrawColor(169, 169, 169);
    // // doc.line(plagiarismSectionX, analyticsStartY + 5, plagiarismSectionX + plagiarismSectionWidth - 10, analyticsStartY + 5);

    // Add table headers
    const tableStartY = analyticsStartY + 5;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    // doc.text("Plagiarism Types", plagiarismSectionX, tableStartY);
    doc.text("Test Coverage", plagiarismSectionX + 40, tableStartY);
    doc.text("Words", plagiarismSectionX + 70, tableStartY);

    // Add a gray line under the headers
    doc.line(plagiarismSectionX, tableStartY + 5, plagiarismSectionX + plagiarismSectionWidth - 10, tableStartY + 5);

    // Add rows for analytics
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);

    let currentY = tableStartY + 15;
    // Calculate the sum of the lengths array under patterns.text.words
    const wordLengthsSum = aidata.explain.patterns.text.words.lengths.reduce((sum, length) => sum + length, 0);
    // Get the total words from matches.text.words.lengths[0]
    const totalWords = aidata.results[0].matches[0].text.words.lengths[0];
    // Calculate the percentage
    const percentage = (wordLengthsSum / totalWords) * 100;


    // Sum the lengths array under patterns.text.words for the second text
    const identicalWordsSum = aidata.explain.patterns.text.words.lengths.reduce((sum, length) => sum + length, 0);
    const humanTextPercentage = 100 - percentage;
    const humanWords = totalWords - wordLengthsSum;




    // Row 1: Identical Insights
    doc.setFillColor(204, 153, 255); // Light purple color for AI Text
    doc.circle(plagiarismSectionX, currentY - 1.5, 1.5, "F");
    doc.text("AI Text", plagiarismSectionX + 3, currentY);

    // Add the percentage to the PDF
    doc.text(`${percentage.toFixed(2)}%`, plagiarismSectionX + 45, currentY);

    // Add the sum to the PDF
    doc.text(`${identicalWordsSum}`, plagiarismSectionX + 70, currentY);

    // Row 2: Minor Changes
    currentY += 5;
    doc.setFillColor(211, 211, 211); // Lighter gray color
    // Gray color for Human Text
    doc.circle(plagiarismSectionX, currentY - 1.5, 1.5, "F");
    doc.text("Human Text", plagiarismSectionX + 3, currentY);
    doc.text(`${humanTextPercentage.toFixed(2)}%`, plagiarismSectionX + 45, currentY);
    doc.text(`${humanWords}`, plagiarismSectionX + 70, currentY);

    // // Row 3: Paraphrased
    // currentY += 5;
    // doc.setFillColor(255, 165, 0);
    // doc.circle(plagiarismSectionX, currentY - 1.5, 1.5, "F");
    // doc.text("Paraphrased", plagiarismSectionX + 3, currentY);
    // doc.text("0%", plagiarismSectionX + 45, currentY);
    // doc.text(`${data.results.score.relatedMeaningWords}`, plagiarismSectionX + 70, currentY);

    // Add a gray line after the rows
    currentY += 5;
    doc.line(plagiarismSectionX, currentY, plagiarismSectionX + plagiarismSectionWidth - 10, currentY);
    currentY += 5;
    // Lighter blue color for the circle
    doc.setFillColor(173, 216, 230); // Light blue color for the fill
    doc.circle(plagiarismSectionX, currentY - 1.5, 1.5, "F"); // Filled circle

    // Dotted outline for the circle
    doc.setLineWidth(0.5); // Thin line for the outline
    doc.setDrawColor(173, 216, 230); // Same light blue for the outline
    doc.circle(plagiarismSectionX, currentY - 1.5, 1.5, "D"); // Dotted circle outlin
    doc.text("Ommitted Words", plagiarismSectionX + 3, currentY);
    doc.text("0%", plagiarismSectionX + 45, currentY);
    doc.text('X', plagiarismSectionX + 70, currentY);
    // currentY += 5;


    // Add excluded words
    // Adjust sectionStartY based on the current content position
    const sectionStartY = currentY + 20;

    // Define the page margins and maximum text width
    const marginLeft = 10;
    const marginRight = 20;
    let maxTextWidth = doc.internal.pageSize.width - marginLeft - marginRight;

    // Add the heading
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text(
        "About Our AI Detection",
        marginLeft,
        sectionStartY
    );

    // Add the body text with wrapping
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    const bodyText =
        "Our AI Detector is the only enterprise-level solution that can verify if the content was written by a human or generated by AI, including source code and text that has been plagiarized or modified";
    const wrappedText = doc.splitTextToSize(bodyText, maxTextWidth);
    doc.text(wrappedText, marginLeft, sectionStartY + 5);


    // Define constants for the rows
    // Constants for layout
    const colSpacing = 20; // Adjust column spacing
    const leftColX = 15; // Left column X position
    const rightColX = doc.internal.pageSize.width / 2 + 5; // Right column X position

    // First row
    let rowY = sectionStartY + 25; // Initial row Y position

    // Left: Identical
    doc.setFillColor(204, 153, 255);// Light Pruple
    doc.circle(leftColX, rowY - 3, 3, "F");
    doc.setFont("times", "bold");
    doc.text("AI Text", leftColX + 5, rowY - 3);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    rowY = addTextWithLink(
        doc,
        "A body of the text that has been generated or altered by AI technology.",
        "Learn more",
        leftColX,
        rowY + 5,
        "lightblue",
        "https://example.com/identical"
    );

    // Right: Minor Changes
    doc.setTextColor(0, 0, 0); // Reset text color
    let minorChangesY = sectionStartY + 23; // Ensure alignment with Identical
    doc.setFillColor(211, 211, 211); // Lighter gray color
    // Gray color for Human Text
    doc.circle(rightColX, minorChangesY - 3, 3, "F");
    doc.setFont("times", "bold");
    doc.setFontSize(10);
    doc.text("Human Text", rightColX + 5, minorChangesY - 2);
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    minorChangesY = addTextWithLink(
        doc,
        "Any text that has been fully written by a human and has not been altered or generated by AI.",
        "Learn more",
        rightColX,
        minorChangesY + 5,
        "lightblue",
        "https://example.com/minor-changes"
    );



    // Continuing from previous code...

    rowY += 2; // Spacing for the next section
    doc.setDrawColor(192); // Set gray color for the line
    doc.setLineWidth(0.5); // Set thin line width
    doc.line(10, rowY, doc.internal.pageSize.width - 10, rowY); // Draw a horizontal line across the page

    // Copyleaks Internal Database
    rowY += 5; // Spacing for the next section
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0); // Reset text color
    doc.text("Skyline Academics AI Detector Effectiveness", 10, rowY); // Use full page width
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    rowY = addTextWithLink(
        doc,
        "Credible data at scale, coupled with machine learning and widespread adoption, allows us to continually refine and improve our ability to understand complex text patterns, resulting in over 99% accuracy—far higher than any other AI detector—and improving daily.",
        "Learn more",
        10, // Start at the left edge of the page
        rowY + 5,
        "lightblue",
        "https://example.com/copyleaks-internal-database",
        1
    );

    // Filtered and Excluded Results
    rowY += 2; // Spacing for the next section
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0); // Reset text color
    doc.text("Ideal Text Length", 10, rowY); // Use full page width
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    rowY = addTextWithLink(
        doc,
        "The higher the character count, the easier for our technology to determine irregular patterns, which results in a higher confidence rating for AI detection.",
        "Learn more",
        10, // Start at the left edge
        rowY + 5,
        "lightblue",
        "https://example.com/filtered-excluded-results",
        1
    );

    // Current Batch Results
    rowY += 2; // Spacing for the next section
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0); // Reset text color
    doc.text("Reasons It Might Be AI When You Think It's Not", 10, rowY); // Use full page width
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    rowY = addTextWithLink(
        doc,
        "The AI Detector can detect a variety of AI-generated text, including tools that use AI technology to paraphrase content, auto-complete sentences, and more.",
        "Learn more",
        10, // Start at the left edge
        rowY + 5,
        "lightblue",
        "https://example.com/current-batch-results",
        1
    );

    // Current Batch Results
    rowY += 2; // Spacing for the next section
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0); // Reset text color
    doc.text("User AI Alert History", 10, rowY); // Use full page width
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    rowY = addTextWithLink(
        doc,
        "Historical data of how many times a user has been flagged for potentially having AI text within their content.",
        "Learn more",
        10, // Start at the left edge
        rowY + 5,
        "lightblue",
        "https://example.com/current-batch-results",
        1
    );
    // Current Batch Results
    rowY += 2; // Spacing for the next section
    doc.setFont("times", "bold");
    doc.setTextColor(0, 0, 0); // Reset text color
    doc.text("AI Insights", 10, rowY); // Use full page width
    doc.setFont("times", "normal");
    doc.setFontSize(8);
    rowY = addTextWithLink(
        doc,
        "The number of times a phrase was found more frequently in AI vs. human text is shown according to low, medium, and high frequency.",
        "Learn more",
        10, // Start at the left edge
        rowY + 5,
        "lightblue",
        "https://example.com/current-batch-results",
        1
    );
    // Reset text color
    doc.setTextColor(0, 0, 0); // Reset text color to black

    const pageHeight = doc.internal.pageSize.height;
    const footerHeight = 10; // Space for the footer

    // // Add the text in the footer center
    doc.setFontSize(10);
    doc.text("Generated by Your App", pageWidth / 2, pageHeight - footerHeight, { align: "center" });

    // Add certification image on the left with "Certified by"
    const certImage = fs.readFileSync(path.join(__dirname, "images/footerbanner_base64.txt"), "utf-8").trim();
    const certImageWidth = 50; // Width of the certification image
    const certImageHeight = 15; // Height of the certification image

    // Add certification image
    doc.addImage(certImage, "PNG", 0, pageHeight - footerHeight - 5, certImageWidth, certImageHeight); // Adjust the position

    // // Add "Certified by" text next to the image with grayish color and bold font
    // doc.setFontSize(16);
    // doc.setFont("times", "bold"); // Set font to bold
    // doc.setTextColor(169, 169, 169); // Set color to a grayish shade (RGB: 169, 169, 169)
    // doc.text("Certified by", 5, pageHeight - footerHeight - 10);


    // Add social media icons to the right side of the footer
    // Function to add social media icons to the footer
    const addSocialMediaIcons = (doc, pageWidth, pageHeight, footerHeight) => {
        const socialMediaMargin = pageWidth - 60; // Start the icons 60 units from the right

        // Define social media links and icon paths
        const socialMediaData = [
            { iconPath: "images/instagram_icon_base64.txt", url: "https://www.instagram.com/yourcompany", xOffset: 0 },
            { iconPath: "images/facebook_icon_base64.txt", url: "https://www.facebook.com/yourcompany", xOffset: 15 },
            { iconPath: "images/linkedin_icon_base64.txt", url: "https://www.linkedin.com/company/yourcompany", xOffset: 30 },
            { iconPath: "images/twitter_icon_base64.txt", url: "https://twitter.com/yourcompany", xOffset: 45 }
        ];

        // Loop through the social media data and add icons
        socialMediaData.forEach((socialMedia) => {
            const iconBase64 = fs.readFileSync(path.join(__dirname, socialMedia.iconPath), "utf-8").trim();
            const xPosition = socialMediaMargin + socialMedia.xOffset;
            const yPosition = pageHeight - footerHeight - 5;
            const iconSize = 10;

            doc.addImage(iconBase64, "PNG", xPosition, yPosition, iconSize, iconSize);
            doc.link(xPosition, pageHeight - footerHeight - 10, iconSize, iconSize, { url: socialMedia.url });
        });
    };

    // Call the function
    addSocialMediaIcons(doc, pageWidth, pageHeight, footerHeight);

    let text = aivalueData.text.value.split(" ");
    const aiStats = aidata.explain.patterns.statistics;
    let aiWords = aidata.explain.patterns.text.words;

    // Extract AI and human counts
    const aiCounts = aiStats.aiCount;
    const humanCounts = aiStats.humanCount;
    let starts = aiWords.starts;
    let lengths = aiWords.lengths;

    // Prepare data by computing percentages
    let data = starts.map((startIndex, i) => {
        const phraseWords = text.slice(startIndex, startIndex + lengths[i]).join(" ");
        const aiPercentage = Math.round((aiCounts[i] / humanCounts[i])); // Convert to percentage

        return {
            phrase: phraseWords,
            aiPercentage: aiPercentage,
            aiText: (aiCounts[i]).toFixed(2),
            humanText: (humanCounts[i]).toFixed(2)
        };
    });

    // Sort by AI percentage (descending)
    data.sort((a, b) => b.aiPercentage - a.aiPercentage);

    // Add a new page
    doc.addPage();

    let x = 10;
    let y = 20;
    let lineHeight = 10;
    let maxY = 280; // Bottom margin before adding a new page
    const lightPurple = [204, 153, 255]; // Light purple color for highlights
    const columnWidth = (doc.internal.pageSize.width - 30) / 2; // Divide page into two columns
    const padding = 5; // Padding between columns

    // Function to draw rounded rectangles
    const drawRoundedRect = (x, y, width, height, radius) => {
        doc.setLineWidth(0.5);
        doc.setDrawColor(0, 0, 0);
        doc.setFillColor(...lightPurple);
        doc.roundedRect(x, y, width, height, radius, radius, "FD"); // Fill and draw
    };


    // Function to handle page breaks
    const checkPageBreak = () => {
        if (y > maxY) {
            doc.addPage();
            y = 20; // Reset y for the new page
        }
    };

    // Write the header
    doc.setFont("helvetica", "bold");
    doc.text("AI & Human Phrase Analysis", x, y);
    y += 15;

    // Function to write a phrase in a column
    const writePhrase = (phraseData, columnX) => {
        const { phrase, aiPercentage, aiText, humanText } = phraseData;

        // Draw rounded rectangle for the percentage and phrase
        const percentageText = `${aiPercentage}X`;
        const phraseText = ` ${phrase}`;
        const percentageWidth = doc.getTextWidth(percentageText);
        const phraseWidth = doc.getTextWidth(phraseText);
        const totalWidth = percentageWidth + phraseWidth + 10; // Add padding

        drawRoundedRect(columnX, y - 6, totalWidth, lineHeight, 3); // Rounded rectangle

        // Write the percentage text (inside rectangle)
        doc.setTextColor(255, 255, 255); // White text for better contrast
        doc.text(percentageText, columnX + 2, y);

        // Write phrase text (next to the percentage)
        doc.setTextColor(0, 0, 0);
        doc.text(phraseText, columnX + percentageWidth + 5, y);
        y += lineHeight;

        // Write AI text and Human text
        doc.setFont("helvetica", "normal");
        const aiTextLabel = `AI text: ${aiText} / 1,000,000 Documents`;
        const humanTextLabel = `Human text: ${humanText} / 1,000,000 Documents`;

        // Align AI and Human text
        const maxLabelWidth = Math.max(doc.getTextWidth(aiTextLabel), doc.getTextWidth(humanTextLabel));
        doc.text(aiTextLabel, columnX + 5, y);
        y += lineHeight;

        doc.text(humanTextLabel, columnX + 5, y);
        y += lineHeight * 1.2; // Reduce vertical space

        // // Draw a triangle around the phrase
        // drawTriangle(columnX + totalWidth / 2 - 5, y - 15, 10); // Adjust position as needed
        // y += lineHeight * 0.5; // Add small space after the triangle
    };

    // Write the sorted phrases in two columns
    for (let i = 0; i < data.length; i += 2) {
        // First column
        writePhrase(data[i], x);
        checkPageBreak();

        // Second column
        if (i + 1 < data.length) {
            writePhrase(data[i + 1], x + columnWidth + padding);
            checkPageBreak();
        }
    }
    // Add a new page before highlighting detected words
    doc.addPage();

    // Extract text and AI-detected word positions
    text = aivalueData.text.value.split(/\s+/); // Splits by space but ignores \n properly
    aiWords = aidata.explain.patterns.text.words;

    x = 10;
    y = 20;
    // let pageWidth = 180;
    const bottomMargin = 280;


    // Loop through words and highlight detected ones
    text.forEach((word, index) => {
        if (!word.trim()) return; // Skip empty words (including \n)

        let isHighlighted = false;
        let wordWidth = doc.getTextWidth(word + " ");

        // Check if the current word should be highlighted
        if (aiWords.starts.includes(index)) {
            isHighlighted = true;

            // Draw highlight rectangle behind the text
            doc.setFillColor(...lightPurple);
            doc.rect(x - 1, y - 7, wordWidth + 2, lineHeight + 2, "F"); // Small highlight box
        }

        // Set text color based on highlight status
        doc.setTextColor(isHighlighted ? 128 : 0, 0, isHighlighted ? 128 : 0); // Purple for AI words

        // Write the word
        doc.text(word, x, y);
        x += wordWidth; // Move x forward for the next word

        // Wrap to next line if needed
        if (x > pageWidth) {
            x = 10;
            y += lineHeight;
        }

        // Check if we need a new page
        if (y > bottomMargin) {
            doc.addPage();
            y = 20; // Reset Y for new page
        }
    });

    return doc;




}


module.exports = {
    mergePDFs,
    addHeaderAndFooterToExistingPDF,
    coverpage,
    PlagiarismdetailedAnalysisPage,
    AiAnalysisPage,
};

