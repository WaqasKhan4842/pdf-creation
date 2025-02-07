/**
 * Overview of the Code:
 * This asynchronous function (`generateReport`) generates a comprehensive report by processing multiple JSON files,
 * creating PDFs, merging them, and adding headers/footers. It handles errors gracefully and ensures all required
 * files are present before proceeding.
 *
 * Key Steps:
 * 1. Extract `userId` and `scanId` from request parameters and validate the folder path.
 * 2. Check for the existence of `scan_results.json` and read its content.
 * 3. Generate PDF pages (cover page and detailed analysis) and save as `part1.pdf`.
 * 4. Add a header and footer to an existing PDF (`plagiarism_report.pdf`) and save as `header_added.pdf`.
 * 5. Merge `part1.pdf` and `header_added.pdf` into `plag.pdf`.
 * 6. Process AI analysis data from `ai_result.json` and `crawled_version.json` to generate `part2.pdf`.
 * 7. Merge `plag.pdf` and `part2.pdf` into the final report (`MergedFinalReport.pdf`).
 * 8. Handle errors and return appropriate HTTP status codes.
 *
 * Helper Functions:
 * - `waitForFiles`: Waits for all required files to be present in the folder.
 * - `generateReportAfterExport`: Triggers report generation via an external API call.
 */



/*
* This is to be added in the try-catch block of the exportResultApi function. 
try {
    const { data } = await axios.request(options);
    console.log(data, "this is success===>");


    // Wait for all files to be created
    await waitForFiles(scanId, userId);

    // Call generateReport after all files are created
    await generateReportAfterExport(scanId, userId);

    return; // Exit here if you don't need to process AI data

  } catch (error) {
    console.error(error, "this .is error");
  }

*/

const { default: axios } = require("axios");
const path = require("path");
const { PDFDocument, rgb } = require("pdf-lib");
const fs = require("fs");
const { mergePDFs,
    addHeaderAndFooterToExistingPDF,
    coverpage,
    PlagiarismdetailedAnalysisPage,
    AiAnalysisPage } = require('./reportUtils');

const BASE_DIR = '/home/Staging-Server/skyline_backend-main';
const REPORTS_DIR = '/home/Staging-Server/skyline_backend-main/ScanDoc';

const generateReport = async (req, res) => {
    try {
        // Extract folderPath from URL params
        const { userId, scanId } = req.params;
        const folderPath = path.join(BASE_DIR, 'ScanDoc', userId.toString(), scanId.toString());
        if (!folderPath) {
            return res.status(400).json({ error: "folderPath is required" });
        }

        console.log("Processing folderPath:", folderPath);

        // Construct full path to scan_result.json (earlier it was named as complete.json)
        const jsonFilePath = path.join(folderPath, "scan_results.json");

        // Check if JSON file exists before reading
        try {
            await fs.promises.access(jsonFilePath);
        } catch (err) {
            return res.status(404).json({ error: "scan_result.json not found in folder" });
        }

        // Read JSON data from the file
        const jsonData = await fs.promises.readFile(jsonFilePath, "utf8");
        const data = JSON.parse(jsonData);

        // Step 1 : Create the first page of the pdf.  
        let doc = coverpage(data);

        // Step 2: Creates the second page of the pdf that contains information related to the pdf section of the Report.
        doc = PlagiarismdetailedAnalysisPage(doc, data);

        // so far two pages are constructed Page 1 and Pags 2 both are stored in one pdf and names as part1.pdf (you can check the result in the folder)

        await doc.save(path.join(folderPath, "part1.pdf"));

        // Paths to your existing PDFs
        let existingPdfPath = path.join(folderPath, "part1.pdf");
        let pdfToMergePath = path.join(folderPath, "header_added.pdf");

        // Paths to input and output PDFs
        const inputPdfPath = path.join(folderPath, "plagiarism_report.pdf");
        const outputPdfPath = path.join(folderPath, "header_added.pdf");
        const headerImagePath = path.join(__dirname, "images", "banner.png");
        const footerImagePath = path.join(__dirname, "images", "footerbanner.png");
        const footerLink = "https://www.google.com";

        try {

            // Step 3: This adds Header and Footer to the recieved pdf with the endpoint copyleaks/export/${userId}/${exportId}/${scanId}/pdf-report`, 
            // which is the plagiarsim pdf. (it simply adds headers and footers to the pdf). This pdf is named as header_added.pdf
            await addHeaderAndFooterToExistingPDF(inputPdfPath, outputPdfPath, headerImagePath, footerImagePath, footerLink, scanId.toString());
            console.log("Header added successfully to the PDF");
        } catch (error) {
            console.error("Error adding header to PDF:", error);
        }

        try {
            //    Step 4: Now this mergers the part1.pdf and the header_added.pdf together while skipping the first page of the header_added.pdf as we
            // have constructed a cover page already as in Step 1.
            const mergedPdfDoc = await mergePDFs(existingPdfPath, pdfToMergePath, true); // Skip first page
            const mergedPdfBytes = await mergedPdfDoc.save();

            // Step 5: Save the merged PDF document to a file  as plag.pdf. 
            await fs.promises.writeFile(path.join(folderPath, "plag.pdf"), mergedPdfBytes);
            console.log("PDFs merged successfully and saved as plag.pdf");
        } catch (error) {
            console.error("Error merging PDFs:", error);
        }


        /*


        Till this point we have a complete pdf report that caters everything related to the Plagiarism Section of 
        Any report. 
        1. We have a cover page.
        2. We have Plagiarism report front page.
        3. We have sources page
        4. We have a QR code 
        5. We have the scanned document already with us.




        */

        // Add AI analysis page
        // Construct full path to scan_result.json
        // Another end-point was constructed to recieve the ai_result from the plagiarism API to take care of 
        // credits used.

        /*
        aiDetection: {
            verb: 'POST',
            headers: [
              ["header-key", "header-value"]
            ],
            endpoint: `http://62.72.58.111:4000/api/scan/copyleaks/export/${userId}/${scanId}/${exportId}/ai-detection`,
          },

          */
        const aiJsonFilepath = path.join(folderPath, "ai_result.json");  
        const aiValueFilepath = path.join(folderPath, "crawled_version.json");

        try {
            await fs.promises.access(aiJsonFilepath);
        } catch (err) {
            return res.status(404).json({ error: "scan_result.json not found in folder" });
        }

        try {
            await fs.promises.access(aiValueFilepath);
        } catch (err) {
            return res.status(404).json({ error: "scan_result.json not found in folder" });
        }
    
        const aijsonData = await fs.promises.readFile(aiJsonFilepath, "utf8");
        const aidata = JSON.parse(aijsonData);
        const aivalueJsonData = await fs.promises.readFile(aiValueFilepath, "utf8");
        const aivalueData = JSON.parse(aivalueJsonData);
        /* From this point onwards we create the second section of the report which is Ai report */
        
        let doc2 = AiAnalysisPage(aidata, aivalueData);
        await doc2.save(path.join(folderPath, "part2.pdf"));

        // Merge final reports
        existingPdfPath = path.join(folderPath, "plag.pdf");
        pdfToMergePath = path.join(folderPath, "part2.pdf");

        try {
            
            // Merge plag.pdf and part2.pdf without skipping any pages
            const finalMergedPdfDoc = await mergePDFs(existingPdfPath, pdfToMergePath, false); // Do not skip first page
            const finalMergedPdfBytes = await finalMergedPdfDoc.save();

            // Save the final merged PDF document
            const finalReportPath = path.join(folderPath, "MergedFinalReport.pdf");
            await fs.promises.writeFile(finalReportPath, mergedPdfBytes);
            console.log("PDFs merged successfully and saved as MergedFinalReport.pdf");

            return res.status(200).json({ message: "Report generated successfully!" });

            // We have a final report stored as MergedFinalReport.pdf (in the end just rename to the file to the name for which we send a download request and we can dowload this version of it)

        } catch (error) {
            console.error("Error merging PDFs:", error);
            return res.status(500).json({ error: "Error merging PDFs" });
        }

    } catch (error) {
        console.error("Error processing folder:", error);
        return res.status(500).json({ error: "Server error while generating report" });
    }
};

/**
 * Helper Function: waitForFiles
 * Waits for all required files to be present in the folder before proceeding.
 * Uses a polling mechanism to check for files every second.
 */
const waitForFiles = async (scanId, userId) => {
    const folderPath = path.join(BASE_DIR, 'ScanDoc', userId.toString(), scanId.toString());
    const requiredFiles = [
        'scan_results.json',
        'plagiarism_report.pdf',
        'ai_result.json',
        'crawled_version.json'
    ];

    const checkFiles = async () => {
        for (const file of requiredFiles) {
            const filePath = path.join(folderPath, file);
            if (!fs.existsSync(filePath)) {
                return false;
            }
        }
        return true;
    };

    let filesExist = await checkFiles();
    while (!filesExist) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for 1 second
        filesExist = await checkFiles();
    }
};

/**
 * Helper Function: generateReportAfterExport
 * Triggers the report generation process by making an HTTP POST request to an external API endpoint.
 * Logs the response or any errors encountered during the process.
 */
const generateReportAfterExport = async (scanId, userId) => {
    const folderPath = path.join(REPORTS_DIR, userId.toString(), scanId.toString());
    try {
        const response = await axios.post(`http://62.72.58.111:4000/api/scan/generate-report/${userId}/${scanId}`);
        console.log('Generate report response:', response.data);
    } catch (error) {
        console.error('Error generating report:', error);
    }
};