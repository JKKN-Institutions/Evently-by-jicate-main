# 🎟️ Comprehensive Ticket Template System

## Overview

The Evently platform now includes a comprehensive ticket template system that allows organizers to customize every aspect of their event tickets during event creation. This system integrates seamlessly with the QR code generation and provides a professional, branded ticket experience.

## 🔧 System Architecture

### Components

1. **TicketTemplateConfigurator** - React component for configuring ticket templates
2. **Database Schema** - Extended events table with `ticket_template` JSONB column
3. **API Integration** - Updated event creation and QR generation APIs
4. **Template Engine** - Existing TicketTemplate component enhanced with configurator data

### Flow Diagram

```
Event Creation → Template Configuration → Database Storage → QR Generation → Ticket Rendering
```

## 🎨 Template Configuration Options

### 1. **Event Branding**
- **Event Logo**: Upload custom logo for tickets
- **Theme Color**: Primary color for ticket design
- **Background Style**: Solid, gradient, or pattern backgrounds
- **Organizer Information**: Name, contact, website, social media

### 2. **Ticket Types & Pricing**
- **Multiple Ticket Types**: General, VIP, Early Bird, Student, Premium, Complimentary
- **Custom Pricing**: Individual pricing for each ticket type
- **Color Coding**: Visual distinction between ticket types
- **Descriptions**: Detailed descriptions for each ticket type
- **Quantity Limits**: Optional maximum quantity per ticket type

### 3. **Event Details Display**
- **Venue Information**: Toggle detailed venue display
- **Entry Time**: Show specific entry times
- **Gate Numbers**: Display gate/entrance information
- **Custom Venue Info**: Additional venue details

### 4. **Attendee Information Collection**
- **Name Collection**: Require attendee names
- **Email Collection**: Collect email addresses
- **Phone Numbers**: Optional phone number collection
- **ID Requirements**: Specify if ID proof is required at entry

### 5. **Security Features**
- **Watermarks**: Add security watermarks to tickets
- **Hologram Effects**: For printed tickets (anti-counterfeiting)
- **QR Code Styles**: Standard, branded, or custom QR codes
- **Encryption**: All QR codes are encrypted for security

### 6. **Terms & Conditions**
- **Custom Terms**: Add specific terms and conditions
- **Transfer Policy**: Allowed, restricted, or not allowed
- **Age Restrictions**: Specify age requirements
- **Refund Policy**: Custom refund policies

### 7. **Additional Features**
- **Seat Selection**: Enable/disable seat selection
- **Check-in System**: Toggle check-in functionality
- **Sponsors**: Add sponsor logos and information
- **Custom Fields**: Additional data collection fields

## 🗄️ Database Schema

### Events Table Extension

```sql
ALTER TABLE events 
ADD COLUMN ticket_template JSONB DEFAULT '{}'::jsonb;
```

### Template Structure

```json
{
  "themeColor": "#3B82F6",
  "backgroundStyle": "solid",
  "eventLogo": "https://...",
  "ticketTypes": [
    {
      "name": "General Admission",
      "price": 500,
      "color": "#3B82F6",
      "description": "Standard entry ticket",
      "maxQuantity": 100
    }
  ],
  "showVenueDetails": true,
  "showEntryTime": false,
  "showGateNumber": false,
  "collectAttendeeInfo": {
    "name": true,
    "email": true,
    "phone": false,
    "idRequired": false
  },
  "organizerName": "JKKN College",
  "organizerLogo": "https://...",
  "organizerContact": "+91 9876543210",
  "website": "https://jkkn.ac.in",
  "socialMedia": {
    "facebook": "jkkncollege",
    "twitter": "@jkkncollege",
    "instagram": "jkkncollege"
  },
  "sponsors": [
    {
      "name": "Sponsor Name",
      "logo": "https://...",
      "website": "https://..."
    }
  ],
  "enableWatermark": true,
  "enableHologram": false,
  "qrCodeStyle": "branded",
  "terms": [
    "This ticket is valid for one-time entry only",
    "Please carry a valid government-issued ID proof",
    "Entry subject to security check"
  ],
  "ageRestriction": "18+ only",
  "refundPolicy": "No refunds after 24 hours",
  "transferPolicy": "allowed",
  "enableSeatSelection": false,
  "enableCheckIn": true
}
```

## 🔄 Integration Points

### 1. Event Creation Flow

```typescript
// In app/events/create/page.tsx
const [ticketTemplate, setTicketTemplate] = useState<TicketTemplateConfig>({
  // Default configuration
})

// Form submission includes template
const eventData = {
  ...formData,
  ticket_template: ticketTemplate
}
```

### 2. QR Code Generation

```typescript
// In app/api/printed-tickets/generate/route.ts
const { data: event } = await supabase
  .from('events')
  .select('id, title, date, organizer_id, ticket_template')
  .eq('id', event_id)
  .single()

// Use template data in ticket generation
const ticketMetadata = {
  ticket_template: event.ticket_template,
  template_version: '1.0'
}
```

### 3. Ticket Rendering

```typescript
// In components/tickets/TicketTemplate.tsx
const ticketData: TicketData = {
  eventName: event.title,
  eventLogo: template.eventLogo,
  themeColor: template.themeColor,
  organizerName: template.organizerName,
  // ... map all template fields
}
```

## 🚀 Usage Instructions

### For Organizers

1. **Create Event**: Navigate to "Create Event" page
2. **Fill Basic Details**: Enter event title, description, date, venue, etc.
3. **Configure Ticket Template**: 
   - Click through the 5 tabs: Branding, Ticket Types, Details, Security, Terms
   - Customize each section according to your needs
   - Use "Show Preview" to see how tickets will look
4. **Submit**: Create the event with your custom template

### For Admins

1. **Generate QR Codes**: Go to "Generate Printed QR" page
2. **Select Event**: Choose any event (admins can access all events)
3. **Generate**: The system automatically uses the event's ticket template
4. **Download**: Get professionally designed tickets with your branding

## 🎯 Benefits

### For Event Organizers
- **Professional Branding**: Consistent brand experience across all tickets
- **Flexibility**: Customize every aspect of ticket design
- **Multiple Ticket Types**: Support various pricing tiers
- **Security**: Built-in anti-counterfeiting features
- **Terms Management**: Clear communication of event policies

### For Attendees
- **Clear Information**: All event details clearly displayed
- **Professional Look**: High-quality, branded tickets
- **Security**: Encrypted QR codes prevent fraud
- **Easy Entry**: Quick scanning at event entrance

### For Administrators
- **Centralized Control**: Manage all event templates
- **Consistency**: Ensure brand standards across events
- **Analytics**: Track ticket types and preferences
- **Security**: Monitor and prevent ticket fraud

## 🔧 Technical Implementation

### Database Functions

```sql
-- Get ticket template with defaults
CREATE FUNCTION get_event_ticket_template(event_id UUID)
RETURNS JSONB

-- Validate template structure
CREATE FUNCTION validate_ticket_template(template JSONB)
RETURNS BOOLEAN
```

### API Endpoints

- `POST /api/events` - Create event with template
- `POST /api/printed-tickets/generate` - Generate tickets using template
- `GET /api/events/[id]` - Retrieve event with template

### React Components

- `TicketTemplateConfigurator` - Configuration interface
- `TicketTemplate` - Rendering component
- `ImageUploadDropzone` - Logo upload handling

## 🔒 Security Considerations

1. **Template Validation**: All templates validated before storage
2. **Access Control**: Only organizers/admins can modify templates
3. **QR Encryption**: All QR codes encrypted with event-specific keys
4. **Image Upload**: Secure image handling with size/type validation
5. **Data Sanitization**: All user inputs sanitized before storage

## 🚀 Future Enhancements

1. **Template Library**: Pre-built templates for different event types
2. **Advanced Branding**: Custom fonts, advanced layouts
3. **Multi-language**: Support for multiple languages
4. **Analytics**: Template performance analytics
5. **API Access**: External API for template management
6. **Mobile App**: Mobile template configuration
7. **Print Integration**: Direct printing service integration

## 📋 Migration Guide

### Existing Events
Run the migration script to add template support:

```sql
-- Apply the migration
\i supabase/add-ticket-template-to-events.sql
```

### Existing Tickets
All existing printed tickets will continue to work. New tickets will use the enhanced template system.

## 🐛 Troubleshooting

### Common Issues

1. **Template Not Saving**: Check validation errors in console
2. **Images Not Uploading**: Verify file size and format
3. **QR Generation Failing**: Ensure template is valid JSON
4. **Preview Not Showing**: Check browser console for errors

### Debug Commands

```sql
-- Check template structure
SELECT id, title, ticket_template FROM events WHERE id = 'event-id';

-- Validate template
SELECT validate_ticket_template(ticket_template) FROM events WHERE id = 'event-id';

-- Get full template with defaults
SELECT get_event_ticket_template('event-id');
```

## 📞 Support

For technical support or feature requests related to the ticket template system, please contact the development team or create an issue in the project repository.

---

*This documentation covers the complete ticket template system implementation. The system is designed to be extensible and can be enhanced with additional features as needed.*
