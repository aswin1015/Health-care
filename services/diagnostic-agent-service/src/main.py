from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from azure.monitor.opentelemetry import configure_azure_monitor
import os, re

if os.getenv("APPLICATIONINSIGHTS_CONNECTION_STRING"):
    try:
        configure_azure_monitor()
    except Exception as e:
        print(f"Warning: Failed to configure Azure Monitor: {e}")

app = FastAPI(title="Diagnostic Agent Service — Aegis Health")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

AZURE_AI_ENDPOINT = os.getenv("AZURE_AI_ENDPOINT", "")
AZURE_AI_KEY = os.getenv("AZURE_AI_KEY", "")

ai_client = None
if AZURE_AI_ENDPOINT and AZURE_AI_KEY and AZURE_AI_KEY != "mock-key":
    try:
        from azure.ai.inference import ChatCompletionsClient
        from azure.core.credentials import AzureKeyCredential
        ai_client = ChatCompletionsClient(endpoint=AZURE_AI_ENDPOINT, credential=AzureKeyCredential(AZURE_AI_KEY))
        print("✅ Azure AI Foundry connected")
    except Exception as e:
        print(f"⚠️ Azure AI Client init error: {e}")
else:
    print("ℹ️ Running in simulation mode — set AZURE_AI_ENDPOINT and AZURE_AI_KEY for live analysis")


class DiagnosticRequest(BaseModel):
    image_url: str
    patient_context: str


def _parse_context(context: str) -> dict:
    """Extract structured fields from the enriched context string."""
    fields = {}
    for line in context.splitlines():
        if ':' in line:
            k, v = line.split(':', 1)
            fields[k.strip()] = v.strip()
    return fields


def _detect_image_type(filename: str, clinical_notes: str) -> str:
    """Determine what kind of scan/image this likely is."""
    name = filename.lower()
    notes = clinical_notes.lower()

    if any(kw in name or kw in notes for kw in ['xray', 'x-ray', 'chest', 'cxr']):
        return 'chest_xray'
    if any(kw in name or kw in notes for kw in ['mri', 'brain', 'spine', 'neuro']):
        return 'mri'
    if any(kw in name or kw in notes for kw in ['ct', 'scan', 'abdomen', 'abdominal']):
        return 'ct_scan'
    if any(kw in name or kw in notes for kw in ['echo', 'ultrasound', 'cardiac', 'heart']):
        return 'ultrasound'
    if any(kw in name or kw in notes for kw in ['arch', 'diagram', 'architecture', 'system']):
        return 'non_medical'
    return 'general'


def _generate_mock_report(filename: str, ctx: dict) -> str:
    """Generate a contextually-aware diagnostic report based on available metadata."""
    patient_name = ctx.get('Patient Name', 'Unknown')
    patient_id = ctx.get('Patient ID', 'Unknown')
    upload_date = ctx.get('Upload Date', 'Unknown')
    clinical_notes = ctx.get('Clinical Notes', 'No additional context provided.')

    image_type = _detect_image_type(filename, clinical_notes)

    # Build type-specific findings
    if image_type == 'chest_xray':
        scan_type = "Chest X-Ray (CXR)"
        findings = """\
• Lung fields: Clear bilaterally, no focal consolidation
• Cardiac silhouette: Within normal limits (CTR < 0.5)
• Pleural spaces: No effusion or pneumothorax detected
• Mediastinum: Midline, no widening
• Bony thorax: No acute fractures or lytic lesions
• Diaphragm: Smooth bilateral domes, well-defined"""
        impression = "No acute cardiopulmonary abnormality detected."
        recommendations = """\
• Correlate with clinical presentation and oxygen saturation
• If symptomatic, consider repeat imaging in 4–6 weeks
• PFTs recommended if chronic dyspnea persists"""

    elif image_type == 'mri':
        scan_type = "Magnetic Resonance Imaging (MRI)"
        findings = """\
• Signal intensity: Normal grey/white matter differentiation
• Ventricles: Normal size and morphology
• Midline: No shift detected
• Extra-axial spaces: No subdural or epidural collections
• Posterior fossa: Cerebellum and brainstem appear normal
• Vascular flow voids: Preserved"""
        impression = "No significant intracranial pathology identified on this study."
        recommendations = """\
• Correlate with neurological examination findings
• Consider contrast-enhanced study if lesion suspected
• Follow-up MRI in 6 months if symptoms persist"""

    elif image_type == 'ct_scan':
        scan_type = "Computed Tomography (CT)"
        findings = """\
• Parenchymal attenuation: Within normal range
• No hyperdense or hypodense lesions identified
• Vascular structures: Normal calibre and enhancement pattern
• Surrounding soft tissues: Unremarkable
• No free air or free fluid in abdomen"""
        impression = "No acute CT findings. Study within normal limits."
        recommendations = """\
• Clinical correlation recommended
• Consider MRI for soft tissue detail if indicated
• Repeat CT in 3 months if clinical concern persists"""

    elif image_type == 'ultrasound':
        scan_type = "Ultrasound / Echocardiogram"
        findings = """\
• Cardiac chambers: Normal size and wall thickness
• Ejection fraction: Estimated normal (≥55%)
• Valves: No significant regurgitation or stenosis
• Pericardium: No effusion detected
• Regional wall motion: Normal throughout"""
        impression = "Echocardiographic findings within normal limits."
        recommendations = """\
• Annual follow-up echocardiogram if risk factors present
• Cardiology consult if symptomatic
• Lifestyle modifications for cardiovascular risk reduction"""

    elif image_type == 'non_medical':
        scan_type = "Non-Medical Image / Document"
        findings = """\
• This appears to be an architectural diagram or system design document
• No anatomical structures identified for medical analysis
• File type appears suitable for system documentation purposes"""
        impression = "This image does not appear to be a medical scan. No diagnostic findings applicable."
        recommendations = """\
• Please upload a medical imaging file (X-ray, MRI, CT, Ultrasound)
• Supported formats: DICOM, JPEG, PNG of actual medical scans
• Contact your radiologist for proper image acquisition"""

    else:
        scan_type = "Medical Image — General"
        findings = """\
• Image quality: Adequate for preliminary review
• Orientation: Standard anatomical position maintained
• Overall impression: No acute abnormalities detected in preliminary scan
• Soft tissues: Unremarkable
• Osseous structures: No acute fractures identified"""
        impression = "No significant findings on preliminary review. Clinical correlation required."
        recommendations = """\
• Correlate with clinical symptoms and history
• Follow-up imaging in 6 months if symptoms persist
• Consult specialist for formal radiological review"""

    # Add clinical-notes-specific commentary if provided
    clinical_section = ""
    if clinical_notes and 'no additional context' not in clinical_notes.lower():
        clinical_section = f"""
📝 CLINICAL CONTEXT ASSESSMENT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Based on clinical notes: "{clinical_notes[:300]}"
• Clinical history has been noted and correlated with imaging findings above
• No imaging features directly attributable to stated clinical concern identified
• Recommend specialist review with full clinical history"""

    report = f"""📋 DIAGNOSTIC AGENT ANALYSIS REPORT
════════════════════════════════════════

🤖 Agent:   Aegis Diagnostic AI (Azure AI Foundry — Simulation Mode)
👤 Patient: {patient_name}  |  ID: {patient_id}
📁 Image:   {filename}
🏷️  Type:    {scan_type}
📅 Date:    {upload_date}

📊 PRELIMINARY FINDINGS:
━━━━━━━━━━━━━━━━━━━━━━
{findings}
{clinical_section}
📌 IMPRESSION:
━━━━━━━━━━━━
{impression}

⚠️ RECOMMENDATIONS:
━━━━━━━━━━━━━━━━━━
{recommendations}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ SIMULATION MODE — For live AI analysis:
   Set AZURE_AI_ENDPOINT and AZURE_AI_KEY
   environment variables in docker-compose.yml
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"""

    return report


@app.post("/analyze")
def analyze_image(req: DiagnosticRequest):
    """
    Diagnostic Agent 2 — Azure AI Foundry Vision Analysis.
    Falls back to a contextually-aware mock report when Azure AI Foundry is not configured.
    """
    filename = req.image_url.split('/')[-1] if '/' in req.image_url else req.image_url
    # Strip UUID prefix if present (e.g. "abc123-filename.png" → "filename.png")
    if re.match(r'^[0-9a-f\-]{36}-', filename):
        filename = filename[37:]

    print(f"🔬 Analyzing: {filename} | Context length: {len(req.patient_context)}")

    if not ai_client:
        ctx = _parse_context(req.patient_context)
        report = _generate_mock_report(filename, ctx)
        return {"status": "success", "mode": "simulation", "report": report}

    try:
        from azure.ai.inference.models import SystemMessage, UserMessage
        response = ai_client.complete(
            model="gpt-4o",
            messages=[
                SystemMessage("You are an expert radiologist AI Agent. Analyze the medical image and provide a structured diagnostic report."),
                UserMessage(f"Patient context:\n{req.patient_context}\n\nImage URL: {req.image_url}")
            ]
        )
        return {"status": "success", "mode": "live", "report": response.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "service": "diagnostic-agent-service",
        "agent": "Azure AI Foundry Diagnostic Agent",
        "mode": "live" if ai_client else "simulation"
    }
