const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, '..', 'public', 'templates');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Template for general events
const generalEventsTemplate = [
  {
    title: 'Tech Conference 2024',
    description: 'Annual technology conference with keynote speakers and workshops',
    date: '2024-12-15',
    time: '09:00',
    venue: 'Convention Center',
    location: '123 Main Street, City, State 12345',
    category: 'Technology',
    price: 299,
    max_attendees: 500,
    status: 'published'
  },
  {
    title: 'Music Festival',
    description: 'Three-day music festival featuring local and international artists',
    date: '2024-12-20',
    time: '18:00',
    venue: 'Open Air Theatre',
    location: 'Park Avenue, Downtown',
    category: 'Music',
    price: 150,
    max_attendees: 1000,
    status: 'published'
  },
  {
    title: 'Food & Wine Expo',
    description: 'Culinary exhibitions, wine tastings, and chef demonstrations',
    date: '2024-12-22',
    time: '11:00',
    venue: 'Exhibition Hall',
    location: 'Downtown Plaza, Building A',
    category: 'Food',
    price: 50,
    max_attendees: 300,
    status: 'draft'
  }
];

// Template for child events (for event pages)
const childEventsTemplate = [
  {
    title: 'Opening Ceremony',
    description: 'Grand inauguration with cultural performances and keynote speeches',
    date: '2025-01-18',
    time: '10:00',
    venue: 'Main Stage',
    location: 'Central Plaza',
    category: 'Ceremony',
    price: 0,
    max_attendees: 500
  },
  {
    title: 'Traditional Dance Performance',
    description: 'Classical dance showcase by renowned artists from across the region',
    date: '2025-01-18',
    time: '11:30',
    venue: 'Dance Arena',
    location: 'North Wing',
    category: 'Cultural',
    price: 50,
    max_attendees: 300
  },
  {
    title: 'Workshop: Digital Marketing',
    description: 'Learn the latest digital marketing strategies and tools',
    date: '2025-01-19',
    time: '14:00',
    venue: 'Workshop Hall',
    location: 'Conference Center, Room 201',
    category: 'Workshop',
    price: 150,
    max_attendees: 50
  }
];

// Instructions for users
const instructions = [
  { 
    Field: 'title', 
    Required: 'Yes', 
    Description: 'Name of the event', 
    Format: 'Text (max 255 chars)',
    Example: 'Annual Tech Summit 2024' 
  },
  { 
    Field: 'description', 
    Required: 'No', 
    Description: 'Detailed description of the event', 
    Format: 'Text (max 1000 chars)',
    Example: 'A comprehensive tech conference featuring industry leaders' 
  },
  { 
    Field: 'date', 
    Required: 'Yes', 
    Description: 'Event date', 
    Format: 'YYYY-MM-DD',
    Example: '2024-12-25' 
  },
  { 
    Field: 'time', 
    Required: 'Yes', 
    Description: 'Event start time', 
    Format: 'HH:MM (24-hour format)',
    Example: '18:30' 
  },
  { 
    Field: 'venue', 
    Required: 'Yes', 
    Description: 'Venue or location name', 
    Format: 'Text',
    Example: 'Convention Center Hall A' 
  },
  { 
    Field: 'location', 
    Required: 'No', 
    Description: 'Full address or location details', 
    Format: 'Text',
    Example: '123 Main St, City, State 12345' 
  },
  { 
    Field: 'category', 
    Required: 'No', 
    Description: 'Event category', 
    Format: 'Select from list',
    Example: 'Technology, Music, Sports, Food, Art, Workshop, Business, Other' 
  },
  { 
    Field: 'price', 
    Required: 'No', 
    Description: 'Ticket price in INR (0 for free events)', 
    Format: 'Number',
    Example: '299' 
  },
  { 
    Field: 'max_attendees', 
    Required: 'No', 
    Description: 'Maximum number of attendees', 
    Format: 'Number',
    Example: '500' 
  },
  { 
    Field: 'status', 
    Required: 'No', 
    Description: 'Publication status (only for general events)', 
    Format: 'draft or published',
    Example: 'published' 
  }
];

// Common validation rules
const validationRules = [
  { Rule: 'Date Format', Description: 'Must be YYYY-MM-DD format', Example: '2024-12-31' },
  { Rule: 'Time Format', Description: 'Must be HH:MM in 24-hour format', Example: '14:30 for 2:30 PM' },
  { Rule: 'Required Fields', Description: 'title, date, time, and venue cannot be empty', Example: 'All rows must have these fields' },
  { Rule: 'Price', Description: 'Must be a positive number or 0 for free events', Example: '0, 50, 299.99' },
  { Rule: 'Max Attendees', Description: 'Must be a positive integer', Example: '50, 100, 1000' },
  { Rule: 'Category Values', Description: 'Should match predefined categories', Example: 'Technology, Music, Sports, etc.' },
  { Rule: 'Status Values', Description: 'Must be either "draft" or "published"', Example: 'published' }
];

// Category options
const categories = [
  { Category: 'Technology', Description: 'Tech conferences, hackathons, coding workshops' },
  { Category: 'Music', Description: 'Concerts, music festivals, performances' },
  { Category: 'Sports', Description: 'Sports events, tournaments, marathons' },
  { Category: 'Food', Description: 'Food festivals, culinary events, wine tastings' },
  { Category: 'Art', Description: 'Art exhibitions, gallery openings, art workshops' },
  { Category: 'Workshop', Description: 'Educational workshops, training sessions' },
  { Category: 'Business', Description: 'Business conferences, networking events' },
  { Category: 'Entertainment', Description: 'Comedy shows, theater, entertainment events' },
  { Category: 'Health', Description: 'Health & wellness events, yoga sessions' },
  { Category: 'Cultural', Description: 'Cultural festivals, traditional events' },
  { Category: 'Exhibition', Description: 'Trade shows, exhibitions, expos' },
  { Category: 'Ceremony', Description: 'Opening/closing ceremonies, award functions' },
  { Category: 'Other', Description: 'Events that don\'t fit other categories' }
];

// Create General Events Template
function createGeneralEventsTemplate() {
  const wb = XLSX.utils.book_new();
  
  // Add events sheet
  const eventsSheet = XLSX.utils.json_to_sheet(generalEventsTemplate);
  XLSX.utils.book_append_sheet(wb, eventsSheet, 'Events');
  
  // Add instructions sheet
  const instructionsSheet = XLSX.utils.json_to_sheet(instructions);
  XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Instructions');
  
  // Add validation rules sheet
  const validationSheet = XLSX.utils.json_to_sheet(validationRules);
  XLSX.utils.book_append_sheet(wb, validationSheet, 'Validation Rules');
  
  // Add categories sheet
  const categoriesSheet = XLSX.utils.json_to_sheet(categories);
  XLSX.utils.book_append_sheet(wb, categoriesSheet, 'Categories');
  
  // Write file
  const outputPath = path.join(outputDir, 'bulk-events-template.xlsx');
  XLSX.writeFile(wb, outputPath);
  console.log('Created:', outputPath);
}

// Create Child Events Template
function createChildEventsTemplate() {
  const wb = XLSX.utils.book_new();
  
  // Add events sheet
  const eventsSheet = XLSX.utils.json_to_sheet(childEventsTemplate);
  XLSX.utils.book_append_sheet(wb, eventsSheet, 'Child Events');
  
  // Add instructions sheet (without status field)
  const childInstructions = instructions.filter(i => i.Field !== 'status');
  const instructionsSheet = XLSX.utils.json_to_sheet(childInstructions);
  XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Instructions');
  
  // Add validation rules sheet
  const validationSheet = XLSX.utils.json_to_sheet(validationRules);
  XLSX.utils.book_append_sheet(wb, validationSheet, 'Validation Rules');
  
  // Add categories sheet
  const categoriesSheet = XLSX.utils.json_to_sheet(categories);
  XLSX.utils.book_append_sheet(wb, categoriesSheet, 'Categories');
  
  // Write file
  const outputPath = path.join(outputDir, 'child-events-template.xlsx');
  XLSX.writeFile(wb, outputPath);
  console.log('Created:', outputPath);
}

// Create Festival/Event Page Template (multiple days)
function createFestivalTemplate() {
  const festivalTemplate = [
    // Day 1
    { title: 'Day 1: Opening Ceremony', description: 'Grand opening with cultural performances', date: '2025-01-18', time: '10:00', venue: 'Main Stage', location: 'Central Plaza', category: 'Ceremony', price: 0, max_attendees: 1000 },
    { title: 'Day 1: Traditional Dance', description: 'Classical dance performances', date: '2025-01-18', time: '11:30', venue: 'Dance Arena', location: 'North Wing', category: 'Cultural', price: 50, max_attendees: 300 },
    { title: 'Day 1: Folk Music Concert', description: 'Traditional folk music', date: '2025-01-18', time: '14:00', venue: 'Music Pavilion', location: 'East Garden', category: 'Music', price: 75, max_attendees: 400 },
    { title: 'Day 1: Art Exhibition', description: 'Contemporary art display', date: '2025-01-18', time: '16:00', venue: 'Art Gallery', location: 'West Block', category: 'Art', price: 0, max_attendees: 200 },
    { title: 'Day 1: Food Festival', description: 'Local cuisine and food stalls', date: '2025-01-18', time: '17:00', venue: 'Food Court', location: 'Central Avenue', category: 'Food', price: 0, max_attendees: 1000 },
    
    // Day 2
    { title: 'Day 2: Kids Carnival', description: 'Fun activities for children', date: '2025-01-19', time: '09:00', venue: 'Kids Zone', location: 'Play Area', category: 'Entertainment', price: 25, max_attendees: 200 },
    { title: 'Day 2: Craft Workshop', description: 'Traditional handicraft demo', date: '2025-01-19', time: '10:00', venue: 'Workshop Hall', location: 'Craft Center', category: 'Workshop', price: 50, max_attendees: 50 },
    { title: 'Day 2: Poetry Session', description: 'Poetry recital and discussion', date: '2025-01-19', time: '11:30', venue: 'Literary Corner', location: 'Library Wing', category: 'Cultural', price: 0, max_attendees: 100 },
    { title: 'Day 2: Film Screening', description: 'Award-winning films showcase', date: '2025-01-19', time: '14:00', venue: 'Cinema Hall', location: 'Media Center', category: 'Entertainment', price: 30, max_attendees: 150 },
    { title: 'Day 2: Rock Concert', description: 'Live rock band performances', date: '2025-01-19', time: '19:00', venue: 'Main Stage', location: 'Central Plaza', category: 'Music', price: 200, max_attendees: 800 },
    
    // Day 3
    { title: 'Day 3: Yoga Session', description: 'Morning yoga and meditation', date: '2025-01-20', time: '06:00', venue: 'Yoga Garden', location: 'Wellness Park', category: 'Health', price: 0, max_attendees: 100 },
    { title: 'Day 3: Photography Walk', description: 'Guided photography tour', date: '2025-01-20', time: '08:00', venue: 'Meeting Point', location: 'Main Gate', category: 'Workshop', price: 25, max_attendees: 30 },
    { title: 'Day 3: Business Summit', description: 'Entrepreneur networking event', date: '2025-01-20', time: '10:00', venue: 'Conference Hall', location: 'Business Center', category: 'Business', price: 99, max_attendees: 200 },
    { title: 'Day 3: Closing Ceremony', description: 'Grand finale with fireworks', date: '2025-01-20', time: '18:00', venue: 'Main Stage', location: 'Central Plaza', category: 'Ceremony', price: 0, max_attendees: 1000 }
  ];
  
  const wb = XLSX.utils.book_new();
  
  // Add events sheet
  const eventsSheet = XLSX.utils.json_to_sheet(festivalTemplate);
  XLSX.utils.book_append_sheet(wb, eventsSheet, 'Festival Events');
  
  // Add instructions
  const instructionsSheet = XLSX.utils.json_to_sheet(instructions.filter(i => i.Field !== 'status'));
  XLSX.utils.book_append_sheet(wb, instructionsSheet, 'Instructions');
  
  // Add categories
  const categoriesSheet = XLSX.utils.json_to_sheet(categories);
  XLSX.utils.book_append_sheet(wb, categoriesSheet, 'Categories');
  
  // Write file
  const outputPath = path.join(outputDir, 'festival-events-template.xlsx');
  XLSX.writeFile(wb, outputPath);
  console.log('Created:', outputPath);
}

// Run all template creators
console.log('Creating Excel templates...\n');
createGeneralEventsTemplate();
createChildEventsTemplate();
createFestivalTemplate();
console.log('\nAll templates created successfully in public/templates/');