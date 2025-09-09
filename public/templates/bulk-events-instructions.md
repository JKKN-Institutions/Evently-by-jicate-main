# Bulk Event Upload Instructions

## File Format
- **Supported formats:** Excel (.xlsx, .xls) or CSV (.csv)
- **Download template:** Use the provided template for best results

## Required Fields
These fields must be present for each event:

| Field | Description | Format | Example |
|-------|-------------|--------|---------|
| **title** | Event name | Text | "Tech Conference 2024" |
| **date** | Event date | YYYY-MM-DD | "2024-12-25" |
| **time** | Event time | HH:MM (24-hour) | "18:00" |
| **venue** | Venue name | Text | "Convention Center" |
| **location** | Full address | Text | "123 Main St, New York, NY" |

## Optional Fields
These fields have default values if not provided:

| Field | Description | Format | Default | Example |
|-------|-------------|--------|---------|---------|
| **description** | Event details | Text | Empty | "Annual tech conference" |
| **category** | Event category | Text | "Other" | "Technology", "Music", "Business", "Sports", "Art", "Food", "Education", "Other" |
| **price** | Ticket price | Number | 0 | 299 |
| **max_attendees** | Maximum capacity | Number | 100 | 500 |
| **status** | Publication status | Text | "draft" | "draft" or "published" |

## Categories
Available categories:
- Technology
- Music
- Business
- Sports
- Art
- Food
- Education
- Other

## Date & Time Format
- **Date:** Must be in YYYY-MM-DD format (e.g., 2024-12-25)
- **Time:** Must be in HH:MM 24-hour format (e.g., 18:00 for 6:00 PM)

## Tips for Success
1. **Use the template:** Download and use the provided Excel template
2. **Check data format:** Ensure dates and times are in the correct format
3. **Remove empty rows:** Delete any blank rows in your file
4. **Start small:** Test with a few events first
5. **Verify required fields:** Make sure all required fields have values

## Common Errors
- **Invalid date format:** Use YYYY-MM-DD format
- **Invalid time format:** Use HH:MM format (24-hour)
- **Missing required fields:** Ensure all required fields are filled
- **Empty rows:** Remove any blank rows from your file

## Status Options
- **draft:** Event is saved but not visible to users
- **published:** Event is live and bookable

## Sample Data
```
title,description,date,time,venue,location,category,price,max_attendees,status
"Annual Tech Summit","Latest technology trends and innovations","2024-12-15","09:00","Tech Center","100 Innovation Way, San Francisco, CA","Technology",299,500,published
"Jazz Night","Live jazz performances","2024-12-20","20:00","Blue Note Club","42 Jazz St, New York, NY","Music",75,200,published
"Startup Workshop","Learn to build your startup","2024-12-22","10:00","Business Hub","200 Startup Ave, Austin, TX","Business",0,50,draft
```