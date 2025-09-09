# API Cleanup Plan

## Files to KEEP (Currently in use):
✅ `/api/tickets/generate` - Main ticket generation
✅ `/api/tickets/generate-pdf-simple` - PDF generation for predefined tickets
✅ `/api/tickets/generate-simple` - Simple generation (enhanced page)
✅ `/api/tickets/verify-simple` - Main verification with QR
✅ `/api/tickets/verify` - Event dashboard verification
✅ `/api/tickets/save-direct` - Direct database save (internal use)

## Files to REMOVE (Duplicates/Unused):
❌ `/api/tickets/generate-bulk`
❌ `/api/tickets/generate-bypass`
❌ `/api/tickets/generate-enhanced`
❌ `/api/tickets/generate-force`
❌ `/api/tickets/generate-pdf`
❌ `/api/tickets/generate-pdf-qr`
❌ `/api/tickets/generate-predefined`
❌ `/api/tickets/generate-with-qr`
❌ `/api/tickets/generate-with-template`
❌ `/api/tickets/verify-camera-qr`
❌ `/api/tickets/verify-enhanced`
❌ `/api/tickets/verify-qr`
❌ `/api/tickets/verify-url`

## Consolidation Plan:
1. Merge any unique features from removed files into kept files
2. Update all references to use only the kept APIs
3. Delete the duplicate files

## Standard Flow:
- **Generate**: `/api/tickets/generate` or `/api/tickets/generate-pdf-simple`
- **Verify**: `/api/tickets/verify-simple`
- **Save**: `/api/tickets/save-direct` (called internally)