# Error Tracking Dashboard

A comprehensive dashboard for monitoring and analyzing system errors from the `jia-error-trace` MongoDB collection.

## Features

### 1. Overview Statistics

- **Total Error Logs**: Shows the total count of all error entries
- **Unique Error Types**: Displays the number of distinct error types
- **Most Common Error**: Shows the most frequently occurring error
- **Bar Chart**: Interactive chart showing error type distribution with clickable bars for filtering

### 2. Line Chart

- **Error Trends**: Shows error count per day for the last 30 days
- **Visual Trends**: Helps identify patterns and spikes in error occurrences

### 3. Error Table

- **Comprehensive View**: Lists all errors with pagination (20 items per page)
- **Search Functionality**: Search by error name, interview ID, or log date
- **Interview Navigation**: Clickable interview IDs that redirect to interview analysis
- **Detailed Modal**: "View Info" button opens a modal with complete error details

### 4. Search & Filtering

- **Real-time Search**: Debounced search across multiple fields
- **Error Type Filtering**: Click on bar chart to filter by specific error types
- **Clear Filters**: Easy reset of all active filters

## API Endpoints

### GET `/api/error-tracking`

Fetches paginated error data with optional search and filtering.

**Query Parameters:**

- `search`: Search term for error name, interview ID, or log date
- `errorName`: Filter by specific error type
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

### GET `/api/error-tracking/stats`

Fetches aggregated statistics and chart data.

**Returns:**

- Total error count
- Unique error types count
- Error type statistics with percentages
- Error count by date for the last 30 days

## Data Structure

The dashboard works with the `jia-error-trace` collection with the following key fields:

```javascript
{
  _id: ObjectId,
  name: "Error Name",
  interviewID: "interview-uuid",
  logDate: "Sep 22 2025 17:59:40",
  createdAt: Date,
  count: 1,
  err: {}, // Error details
  errCode: "ERROR_CODE",
  errTrace: "Stack trace"
}
```

## Usage

1. Navigate to `/log-watch` (requires super admin access)
2. Use the search bar to find specific errors
3. Click on bar chart segments to filter by error type
4. Click "View Info" in the table to see detailed error information
5. Click on interview IDs to navigate to interview analysis
6. Use the refresh button to update all data

## Technical Details

- Built with React and Next.js
- Uses Bootstrap 4 for styling
- Charts powered by Reaviz library
- MongoDB aggregation for efficient data processing
- Debounced search for optimal performance
- Responsive design for all screen sizes
