import type { ExchangeRates, ImportProcess, Claim, Task, VesselScheduleEntry, ExtractedItem, ExtractedContainer, ContainerTrackingInfo } from '../types';

// --- All functions are now mocked to return static data for frontend-only operation ---

export const geminiGetExchangeRates = async (date: string): Promise<ExchangeRates> => {
    console.log(`MOCKING exchange rates for date: ${date}`);
    return Promise.resolve({
        date: date,
        time: "10:00 (Mock)",
        usd: { compra: 5.25, venda: 5.26 },
        eur: { compra: 5.68, venda: 5.69 },
        cny: 0.725
    });
};

export const geminiExtractDataFromDocument = async (base64Image: string, mimeType: string): Promise<Partial<ImportProcess> & {fobValue?: number}> => {
    console.log("MOCKING document data extraction.");
    // Simulate a delay
    await new Promise(res => setTimeout(res, 1500));
    return Promise.resolve({ 
        importNumber: "MOCK-IMP-001",
        poNumbers: "PO-MOCK-123",
        blNumber: "MOCKBL1234567",
        supplier: "Mock Supplier Inc.",
        vesselName: "Mock Vessel",
        voyageNumber: 'V001M',
        portOfLoading: "CNSHA",
        portOfDischarge: "BRSSA",
        incoterm: "FOB",
        dates: { orderPlaced: "2024-07-01" },
        fobValue: 55000.75 
    });
}

export const geminiExtractItemDetails = async (base64Image: string, mimeType: string): Promise<ExtractedItem[]> => {
    console.log("MOCKING item details extraction.");
    await new Promise(res => setTimeout(res, 1500));
    return Promise.resolve([
        { name: "Mock Item A (Extracted)", quantity: 15, unitValue: 1200, vin: "VINMOCKA001" },
        { name: "Mock Item B (Extracted)", quantity: 30, unitValue: 850, vin: "VINMOCKB002" },
    ]);
}

export const geminiExtractContainerDetails = async (base64Image: string, mimeType: string): Promise<ExtractedContainer[]> => {
    console.log("MOCKING container details extraction.");
    await new Promise(res => setTimeout(res, 1500));
    return Promise.resolve([
        { containerNumber: "MOCKU1234567", sealNumber: "SEALMOCK1" },
        { containerNumber: "MOCKU7654321", sealNumber: "SEALMOCK2" }
    ]);
}

export const geminiSuggestNCM = async (productDescription: string): Promise<string> => {
    console.log(`MOCKING NCM suggestion for: ${productDescription}`);
    await new Promise(res => setTimeout(res, 500));
    return Promise.resolve("8703.80.00");
}

export const geminiPredictLeadTime = async (currentImport: ImportProcess, historicalData: ImportProcess[]): Promise<{clearance: string, delivery: string}> => {
    console.log("MOCKING lead time prediction.");
    await new Promise(res => setTimeout(res, 1000));
    const arrival = new Date(currentImport.dates.estimatedArrival || Date.now());
    const clearanceDate = new Date(arrival.getTime() + 5 * 24 * 60 * 60 * 1000); // +5 days
    const deliveryDate = new Date(clearanceDate.getTime() + 3 * 24 * 60 * 60 * 1000); // +3 days
    return Promise.resolve({ 
        clearance: clearanceDate.toISOString().split('T')[0], 
        delivery: deliveryDate.toISOString().split('T')[0] 
    });
}

export const geminiGetContainerTrackingInfo = async (containerNumber: string): Promise<ContainerTrackingInfo> => {
    console.log(`MOCKING tracking for container: ${containerNumber}`);
    await new Promise(res => setTimeout(res, 800));
    return Promise.resolve({
        etaFromCarrier: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        currentStatus: 'At Port',
        milestones: [
            { description: 'Discharged', location: 'Port of Salvador (Mock)', date: new Date().toISOString() },
            { description: 'Loaded on vessel', location: 'Port of Shanghai (Mock)', date: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString() }
        ],
        lastSync: new Date().toISOString()
    });
}

export const geminiSendEmailNotification = async (recipients: string[], subject: string, body: string): Promise<string> => {
    console.log(`MOCKING email notification to ${recipients.join(', ')} with subject "${subject}"`);
    return Promise.resolve("Email simulated successfully (Mock).");
}

export const geminiGenerateSmartSummary = async (imports: ImportProcess[], claims: Claim[], tasks: Task[]): Promise<string> => {
    console.log("MOCKING smart summary generation.");
    await new Promise(res => setTimeout(res, 1200));
    return Promise.resolve(`
**Daily Briefing (Mock Data)**
- **Critical Alerts:** There are 3 imports with demurrage risk within the next 5 days. Focus on BR-2024-001.
- **Pending Tasks:** 5 high-priority tasks are overdue. User "Logistic Coordinator" has the most pending tasks.
- **Inbound Volume:** High volume of containers expected next week. Consider alerting the warehouse team.
- **Financials:** An estimated R$ 250,000.00 in duties is due this week.
    `);
}