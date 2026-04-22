export function hasUnavailableDateBetween(
  unavailableDates: string[],
  start: Date,
  end: Date,
): boolean {
  // Normalize start and end dates to date-only (YYYY-MM-DD) for comparison
  const startDateStr = start.toISOString().split('T')[0]
  const endDateStr = end.toISOString().split('T')[0]
  
  return unavailableDates.some((dateStr) => {
    // Extract date part from ISO string (YYYY-MM-DD)
    const unavailableDatePart = dateStr.split('T')[0]
    
    // Compare date strings (YYYY-MM-DD format allows string comparison)
    return unavailableDatePart > startDateStr && unavailableDatePart <= endDateStr
  })
}
