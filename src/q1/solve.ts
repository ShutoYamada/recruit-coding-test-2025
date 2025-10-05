type AgeCategory = 'Adult' | 'Young' | 'Child';
type Rating = 'G' | 'PG-12' | 'R18+';

interface Ticket {                                                   //defining ticket structure
  age: AgeCategory;
  rating: Rating;
  startTime: string;
  duration: string;
  seat: string;
}

function parseTicket(line: string): Ticket {                        //parsing ticket info
  const [age, rating, startTime, duration, seat] = line.split(',') as [AgeCategory, Rating, string, string, string];
  return { age, rating, startTime, duration, seat };
}

function getEndTime(start: string, duration: string): string {       //calculating end time
  const [sh, sm] = start.split(':').map(Number);
  const [dh, dm] = duration.split(':').map(Number);
  let hour = sh + dh;
  let min = sm + dm;
  if (min >= 60) {                                                    // if minutes exceed 60
    hour += 1;
    min -= 60;
  }
  return `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

function isAfter(time: string, limit: string): boolean {              //comparing time to end time
  const [h1, m1] = time.split(':').map(Number);
  const [h2, m2] = limit.split(':').map(Number);
  return h1 > h2 || (h1 === h2 && m1 > m2);
}

function getPrice(age: AgeCategory): number {                         //setting price
  return age === 'Adult' ? 1800 : age === 'Young' ? 1200 : 800;
}

function validateTicket(ticket: Ticket, group: Ticket[]): string[] {  //validating ticket
  const reasons: string[] = [];
  const hasAdult = group.some(t => t.age === 'Adult');               // Check adult
  const includesChild = group.some(t => t.age === 'Child');          // Check child
  const includesYoung = group.some(t => t.age === 'Young');          // Check young

  const latestEnd = group
    .map(t => getEndTime(t.startTime, t.duration))
    .sort()
    .pop()!;

  // Group-level time restriction
  if (!hasAdult) {
    if (includesChild && isAfter(latestEnd, '16:00')) {
      if (ticket.age === 'Child' || ticket.age === 'Young') {
        reasons.push('対象の映画の入場には大人の同伴が必要です');         // child or young + no adult + end after 16:00
      }
    } else if (includesYoung && isAfter(latestEnd, '18:00')) {
      if (ticket.age === 'Young') {
        reasons.push('対象の映画の入場には大人の同伴が必要です');         // young + no adult + end after 18:00
      }
    }
  }

  // 2. Age restriction
  if (ticket.rating === 'PG-12' && ticket.age === 'Child' && !hasAdult) {
    reasons.push('対象の映画は年齢制限により閲覧できません');           // child + PG-12 without adult
  }
  if (ticket.rating === 'R18+' && ticket.age !== 'Adult') {
    reasons.push('対象の映画は年齢制限により閲覧できません');           // not adult + R18+
  }

  // 3. Seat restriction
  const row = ticket.seat.split('-')[0];                            // Extract row letter
  if (ticket.age === 'Child' && ['J', 'K', 'L'].includes(row)) {    // child + J/K/L row
    reasons.push('対象のチケットではその座席をご利用いただけません');
  }

  return reasons;
}

function isValidTicketLine(line: string): boolean {                   //validating input format
  const parts = line.split(',');
  if (parts.length !== 5) return false;

  const [age, rating, startTime, duration, seat] = parts;             // i hate this part....

  const validAges = ['Adult', 'Young', 'Child'];
  const validRatings = ['G', 'PG-12', 'R18+'];
  if (!validAges.includes(age)) return false;                         // Validate age
  if (!validRatings.includes(rating)) return false;                   // Validate rating

  const timeRegex = /^([01]?\d|2[0-3]):[0-5]\d$/;                     // Validate time format
  const durationRegex = /^([0-9]|1[0-9]|2[0-3]):[0-5]\d$/;            // Validate duration format
  if (!timeRegex.test(startTime)) return false;                       // Validate start time
  if (!durationRegex.test(duration)) return false;                    // Validate duration

  const seatMatch = seat.match(/^([A-L])-([1-9]|1[0-9]|2[0-4])$/);    // Validate seat format
  if (!seatMatch) return false;                                       // Validate seat row and number

  return true;
}


export function solve(input: string): string {                       //main function
  const lines = input.trim().split('\n');
  if (!lines.every(isValidTicketLine)) {                             // Validate all lines
    return '不正な入力です';
  }

  const tickets = lines.map(parseTicket);                            //parsing each ticket line

  const results = tickets.map(ticket => {
    const reasons = validateTicket(ticket, tickets);                  //validating each ticket
    if (reasons.length === 0) {
      return `${getPrice(ticket.age)}円`;                             // No invalid tickets, return price
    } else {
      const ordered = [
        '対象の映画の入場には大人の同伴が必要です',
        '対象の映画は年齢制限により閲覧できません',
        '対象のチケットではその座席をご利用いただけません'
      ];
      return ordered.filter(r => reasons.includes(r)).join(',');
    }
  });


  const hasError = results.some(r => !r.endsWith('円'));  //check if any ticket has error
  if (hasError) {
    return results.filter(r => !r.endsWith('円')).join('\n'); //return only error messages
  }

  return results.join('\n');
}



