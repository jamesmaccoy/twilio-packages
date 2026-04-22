/**
 * Parse an iCal feed URL and extract unavailable dates from VEVENT entries
 * Returns an array of ISO date strings (YYYY-MM-DD format)
 */
export async function parseICalFeed(icalUrl: string): Promise<string[]> {
  try {
    // Create an AbortController for timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    // Fetch the iCal feed
    const response = await fetch(icalUrl, {
      headers: {
        'User-Agent': 'SimplePlek/1.0',
      },
      signal: controller.signal,
    })
    
    clearTimeout(timeoutId)

    if (!response.ok) {
      console.error(`Failed to fetch iCal feed: ${response.status} ${response.statusText}`)
      return []
    }

    const icalText = await response.text()
    
    // Parse the iCal content
    const unavailableDates: string[] = []
    const lines = icalText.split(/\r?\n/)
    
    let currentEvent: {
      dtstart?: string
      dtend?: string
    } | null = null
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // Handle line continuation (lines starting with space or tab)
      let fullLine = line
      if (line.startsWith(' ') || line.startsWith('\t')) {
        // This is a continuation of the previous line
        continue
      }
      
      // Check for multi-line values (RFC 5545)
      let j = i + 1
      while (j < lines.length && (lines[j].startsWith(' ') || lines[j].startsWith('\t'))) {
        fullLine += lines[j].substring(1) // Remove leading space/tab
        j++
      }
      i = j - 1 // Skip processed continuation lines
      
      // Parse VEVENT block
      if (fullLine.startsWith('BEGIN:VEVENT')) {
        currentEvent = {}
      } else if (fullLine.startsWith('END:VEVENT')) {
        if (currentEvent && currentEvent.dtstart && currentEvent.dtend) {
          // Parse dates and add all dates in the range to unavailable dates
          const startDate = parseICalDate(currentEvent.dtstart)
          const endDate = parseICalDate(currentEvent.dtend)
          
          if (startDate && endDate) {
            // Generate all dates in the range (excluding check-out date)
            const currentDate = new Date(startDate)
            while (currentDate < endDate) {
              const dateISO = currentDate.toISOString().split('T')[0]
              unavailableDates.push(dateISO)
              currentDate.setUTCDate(currentDate.getUTCDate() + 1)
            }
          }
        }
        currentEvent = null
      } else if (currentEvent) {
        // Parse DTSTART and DTEND
        if (fullLine.startsWith('DTSTART')) {
          const value = extractICalValue(fullLine)
          if (value) {
            currentEvent.dtstart = value
          }
        } else if (fullLine.startsWith('DTEND')) {
          const value = extractICalValue(fullLine)
          if (value) {
            currentEvent.dtend = value
          }
        }
      }
    }
    
    // Remove duplicates and sort
    const uniqueDates = [...new Set(unavailableDates)].sort()
    
    console.log(`📅 Parsed ${uniqueDates.length} unavailable dates from Google Calendar`)
    
    return uniqueDates
  } catch (error) {
    console.error('Error parsing iCal feed:', error)
    return []
  }
}

/**
 * Extract value from an iCal property line
 * Handles both simple (PROP:VALUE) and parameterized (PROP;PARAM=VALUE:VALUE) formats
 */
function extractICalValue(line: string): string | null {
  const colonIndex = line.indexOf(':')
  if (colonIndex === -1) return null
  
  return line.substring(colonIndex + 1).trim()
}

/**
 * Parse an iCal date string to a Date object
 * Supports both date-time (YYYYMMDDTHHmmssZ) and date-only (YYYYMMDD) formats
 */
function parseICalDate(dateStr: string): Date | null {
  try {
    // Remove any parameters (e.g., DTSTART;VALUE=DATE:20240101)
    const value = dateStr.split(':').pop()?.trim()
    if (!value) return null
    
    // Handle date-time format (YYYYMMDDTHHmmssZ or YYYYMMDDTHHmmss)
    if (value.includes('T')) {
      // Format: YYYYMMDDTHHmmssZ or YYYYMMDDTHHmmss
      const datePart = value.substring(0, 8) // YYYYMMDD
      const timePart = value.substring(9) // HHmmss or HHmmssZ
      
      const year = parseInt(datePart.substring(0, 4), 10)
      const month = parseInt(datePart.substring(4, 6), 10) - 1 // Month is 0-indexed
      const day = parseInt(datePart.substring(6, 8), 10)
      
      let hour = 0
      let minute = 0
      let second = 0
      
      if (timePart && timePart.length >= 6) {
        hour = parseInt(timePart.substring(0, 2), 10)
        minute = parseInt(timePart.substring(2, 4), 10)
        second = parseInt(timePart.substring(4, 6), 10)
      }
      
      // Check if timezone is UTC (Z suffix)
      if (value.endsWith('Z')) {
        return new Date(Date.UTC(year, month, day, hour, minute, second))
      } else {
        // Assume local time if no timezone specified
        return new Date(year, month, day, hour, minute, second)
      }
    } else {
      // Handle date-only format (YYYYMMDD)
      if (value.length === 8) {
        const year = parseInt(value.substring(0, 4), 10)
        const month = parseInt(value.substring(4, 6), 10) - 1 // Month is 0-indexed
        const day = parseInt(value.substring(6, 8), 10)
        
        // Date-only values are typically in local time, but we'll use UTC for consistency
        return new Date(Date.UTC(year, month, day, 0, 0, 0))
      }
    }
    
    return null
  } catch (error) {
    console.error('Error parsing iCal date:', dateStr, error)
    return null
  }
}

