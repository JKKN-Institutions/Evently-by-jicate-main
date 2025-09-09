# Bulk Upload Templates & Guide

## Available Templates

### 1. General Events Template (`bulk-events-template.xlsx`)
For uploading standalone events to the main events page.

### 2. Child Events Template (`child-events-template.xlsx`)
For uploading multiple events under an Event Page (like a festival or conference).

### 3. Festival Events Template (`festival-events-template.xlsx`)
Pre-filled template for multi-day festivals with various event types.

## Download Templates

Templates are available in the following formats:
- **Excel (.xlsx)** - Recommended, includes multiple sheets with instructions
- **CSV (.csv)** - Simple format for basic uploads

Download from: `/public/templates/` directory

## Field Reference

### Required Fields
| Field | Format | Example | Description |
|-------|--------|---------|-------------|
| **title** | Text (max 255 chars) | "Tech Conference 2024" | Event name |
| **date** | YYYY-MM-DD | "2024-12-25" | Event date |
| **time** | HH:MM (24-hour) | "18:30" | Start time |
| **venue** | Text | "Convention Center" | Venue name |

### Optional Fields
| Field | Format | Default | Example | Description |
|-------|--------|---------|---------|-------------|
| **description** | Text (max 1000 chars) | Empty | "Annual tech summit..." | Event details |
| **location** | Text | Empty | "123 Main St, City" | Full address |
| **category** | Predefined list | "Other" | "Technology" | Event category |
| **price** | Number | 0 | "299" | Ticket price in INR |
| **max_attendees** | Number | 100 | "500" | Maximum capacity |
| **status** | draft/published | "draft" | "published" | Publication status* |

*Note: Status field is only for general events, not child events.

## Categories

Available categories for events:
- **Technology** - Tech conferences, hackathons, coding workshops
- **Music** - Concerts, music festivals, performances
- **Sports** - Sports events, tournaments, marathons
- **Food** - Food festivals, culinary events, wine tastings
- **Art** - Art exhibitions, gallery openings, art workshops
- **Workshop** - Educational workshops, training sessions
- **Business** - Business conferences, networking events
- **Entertainment** - Comedy shows, theater, entertainment events
- **Health** - Health & wellness events, yoga sessions
- **Cultural** - Cultural festivals, traditional events
- **Exhibition** - Trade shows, exhibitions, expos
- **Ceremony** - Opening/closing ceremonies, award functions
- **Other** - Events that don't fit other categories

## Date & Time Formatting

### Date Format
- **Format**: YYYY-MM-DD
- **Examples**: 
  - 2024-12-25 (December 25, 2024)
  - 2025-01-15 (January 15, 2025)

### Time Format
- **Format**: HH:MM (24-hour format)
- **Examples**:
  - 09:00 (9:00 AM)
  - 14:30 (2:30 PM)
  - 18:00 (6:00 PM)
  - 20:45 (8:45 PM)

## Sample Data

### Single Day Event
```csv
title,description,date,time,venue,location,category,price,max_attendees
Tech Summit 2024,Annual technology conference,2024-12-15,09:00,Convention Center,123 Main St,Technology,299,500
```

### Multi-Day Festival (Child Events)
```csv
title,description,date,time,venue,location,category,price,max_attendees
Opening Ceremony,Grand inauguration,2025-01-18,10:00,Main Stage,Central Plaza,Ceremony,0,1000
Music Concert,Live performances,2025-01-18,18:00,Music Hall,North Wing,Music,150,500
Workshop Day 1,Hands-on sessions,2025-01-19,09:00,Workshop Hall,Building B,Workshop,99,50
Closing Ceremony,Grand finale,2025-01-20,18:00,Main Stage,Central Plaza,Ceremony,0,1000
```

## Upload Process

### For General Events
1. Navigate to **Events** page
2. Click **"Bulk Upload"** button
3. Download template or use your prepared file
4. Upload the file
5. Review results

### For Event Page Child Events
1. Navigate to specific **Event Page**
2. Click **"Bulk Upload"** button in the header
3. Download child events template
4. Upload the file
5. Events will be automatically linked to the current event page

## Validation Rules

1. **Required Fields**: title, date, time, venue must not be empty
2. **Date Format**: Must be YYYY-MM-DD format
3. **Time Format**: Must be HH:MM in 24-hour format
4. **Price**: Must be a positive number or 0
5. **Max Attendees**: Must be a positive integer
6. **Category**: Should match predefined categories
7. **Status**: Must be "draft" or "published" (general events only)

## Error Handling

The system will show:
- ✅ **Success Count**: Number of successfully uploaded events
- ❌ **Failed Count**: Number of failed uploads with reasons
- ⚠️ **Skipped Rows**: Rows with validation errors

### Common Errors
- "Title is required" - Empty title field
- "Invalid date format" - Date not in YYYY-MM-DD format
- "Invalid time format" - Time not in HH:MM format
- "Venue is required" - Empty venue field

## Tips for Success

1. **Start with the template** - Download and modify the provided template
2. **Validate dates** - Ensure all dates are in the future and correctly formatted
3. **Check required fields** - Title, date, time, and venue are mandatory
4. **Use predefined categories** - Stick to the available category options
5. **Test with small batches** - Upload a few events first to test
6. **Review before upload** - Check your data in Excel/CSV before uploading

## File Size Limits

- Maximum file size: 10MB
- Maximum rows: 1000 events per upload
- Supported formats: .xlsx, .xls, .csv

## Permissions

- **General Events**: Organizers and Admins can bulk upload
- **Child Events**: Page Controllers and Admins can bulk upload
- **Templates**: Available to all users for download

## Support

For issues or questions about bulk upload:
1. Check this guide first
2. Verify your data matches the template format
3. Contact admin support if errors persist