import { parse } from 'csv-parse/sync';
import * as EmailValidator from 'email-validator';
import { stringify } from 'csv-stringify/sync';

/*
 * Input CSV data types
 */
type Constituent = {
  'Patron ID': string;
  'First Name'?: string;
  'Last Name'?: string;
  'Date Entered'?: string;
  'Primary Email'?: string;
  Company?: string;
  Salutation?: string;
  Title?: string;
  Tags?: string;
  Gender?: string; // Note: Gender field is actually used for marital status
};

type DonationHistory = {
  'Patron ID': string;
  'Donation Amount': string;
  'Donation Date': string;
  'Payment Method': string;
  Campaign: string;
  Status: string;
};

type Email = {
  'Patron ID': string;
  Email: string;
};

type TagMapping = {
  name: string;
  mapped_name: string;
};

/*
 * Output CSV data types
 */
type ProcessedConstituent = {
  'CB Constituent ID': string;
  'CB Constituent Type': 'Person' | 'Company';
  'CB First Name': string;
  'CB Last Name': string;
  'CB Company Name': string;
  'CB Created At': string;
  'CB Email 1 (Standardized)': string;
  'CB Email 2 (Standardized)': string;
  'CB Title': string;
  'CB Tags': string;
  'CB Background Information': string;
  'CB Lifetime Donation Amount': string;
  'CB Most Recent Donation Date': string;
  'CB Most Recent Donation Amount': string;
};

type ProcessedTag = {
  'CB Tag Name': string;
  'CB Tag Count': number;
};

/*
 * Helper functions
 */

/**
 * Validates and standardizes email addresses
 */
const standardizeEmail = (email: string): string => {
  if (!email) return '';
  const trimmedEmail = email.trim().toLowerCase();
  // Only return the email if it's valid
  return EmailValidator.validate(trimmedEmail) ? trimmedEmail : '';
};

/**
 * Formats currency values to $XX.XX format
 */
const formatCurrency = (amount: string): string => {
  if (!amount) return '';
  const numericAmount = parseFloat(amount.replace(/[$,]/g, ''));
  return `$${numericAmount.toFixed(2)}`;
};

/**
 * Handles multiple date formats and converts to ISO string
 * Supports both "YYYY-MM-DD" and "MM/DD/YYYY" formats
 * Returns empty string for invalid dates
 */
const formatDate = (date: string): string => {
  if (!date) return '';

  // Try parsing the date string directly first
  let parsedDate = new Date(date);

  // If the date is invalid, try parsing MM/DD/YYYY format
  if (isNaN(parsedDate.getTime())) {
    const [month, day, year] = date.split('/');
    parsedDate = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
  }

  // If still invalid, return empty string
  if (isNaN(parsedDate.getTime())) {
    return '';
  }

  return parsedDate.toISOString();
};

/**
 * Validates titles against allowed values per requirements
 * Only accepts: "Mr.", "Mrs.", "Ms.", "Dr."
 */
const validateTitle = (title: string): string => {
  const validTitles = ['Mr.', 'Mrs.', 'Ms.', 'Dr.'];
  return validTitles.includes(title) ? title : '';
};

/**
 * Formats background information according to requirements
 * Combines job title and marital status (stored in gender field)
 */
const formatBackgroundInfo = (title: string | undefined, gender: string | undefined): string => {
  const parts: string[] = [];

  if (title) {
    parts.push(`Job Title: ${title}`);
  }

  if (gender) {
    // Gender field is used for marital status
    parts.push(`Marital Status: ${gender}`);
  }

  return parts.join('; ');
};

/**
 * Main function to process a single constituent
 */
const processConstituent = async (
  constituent: Constituent,
  emails: Email[],
  donations: DonationHistory[],
  tagMappings: TagMapping[],
): Promise<ProcessedConstituent> => {
  const primaryEmail = standardizeEmail(constituent['Primary Email'] || '');

  // Filter and standardize additional emails
  const constituentEmails = emails
    .filter((e) => e['Patron ID'] === constituent['Patron ID'])
    .map((e) => standardizeEmail(e.Email))
    .filter(Boolean);

  // Primary email should default to the first email in the Emails sheet if it exists
  const allEmails = primaryEmail
    ? [primaryEmail, ...constituentEmails.filter((e) => e !== primaryEmail)]
    : constituentEmails;

  // Process donations
  const constituentDonations = donations
    .filter((d) => d['Patron ID'] === constituent['Patron ID'])
    .map((d) => ({
      amount: formatCurrency(d['Donation Amount']),
      date: formatDate(d['Donation Date']),
      status: d.Status,
    }))
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Calculate lifetime donations (subtract refunded amounts)
  const lifetimeDonations = constituentDonations.reduce((sum, donation) => {
    const amount = parseFloat(donation.amount.substring(1)); // Remove $ sign
    return sum + (donation.status === 'Paid' ? amount : -amount);
  }, 0);

  // Get most recent paid donation
  const mostRecentPaidDonation = constituentDonations.find((d) => d.status === 'Paid');

  // Transform tags to their mapped names
  const tags = constituent.Tags
    ? constituent.Tags.split(',')
        .map((tag) => {
          const mapping = tagMappings.find((m) => m.name === tag.trim());
          return mapping ? mapping.mapped_name : tag.trim();
        })
        .join(',')
    : '';

  // A constituent is a company if it has a company name and no first or last name
  const isCompany = !constituent['First Name'] && !constituent['Last Name'] && Boolean(constituent.Company);

  // Format background information
  const backgroundInfo = formatBackgroundInfo(constituent.Title, constituent.Gender);

  return {
    'CB Constituent ID': constituent['Patron ID'],
    'CB Constituent Type': isCompany ? 'Company' : 'Person',
    'CB First Name': isCompany ? '' : constituent['First Name'] || '',
    'CB Last Name': isCompany ? '' : constituent['Last Name'] || '',
    'CB Company Name': isCompany ? constituent.Company || '' : '',
    'CB Created At': formatDate(constituent['Date Entered'] || ''),
    'CB Email 1 (Standardized)': allEmails[0] || '',
    'CB Email 2 (Standardized)': allEmails[1] || '',
    'CB Title': validateTitle(constituent.Salutation || ''),
    'CB Tags': tags,
    'CB Background Information': backgroundInfo,
    'CB Lifetime Donation Amount': lifetimeDonations > 0 ? formatCurrency(lifetimeDonations.toString()) : '',
    'CB Most Recent Donation Date': mostRecentPaidDonation?.date || '',
    'CB Most Recent Donation Amount': mostRecentPaidDonation?.amount || '',
  };
};

/**
 * Processes tag counts for all constituents
 * Creates a summary of how many constituents have each tag
 */
const processTagCounts = (constituents: ProcessedConstituent[]): ProcessedTag[] => {
  const tagCounts = new Map<string, number>();

  constituents.forEach((constituent) => {
    if (constituent['CB Tags']) {
      constituent['CB Tags'].split(',').forEach((tag) => {
        const trimmedTag = tag.trim();
        tagCounts.set(trimmedTag, (tagCounts.get(trimmedTag) || 0) + 1);
      });
    }
  });

  return Array.from(tagCounts.entries()).map(([tag, count]) => ({
    'CB Tag Name': tag,
    'CB Tag Count': count,
  }));
};

/**
 * Main entry point for processing all files
 */
export async function processFiles(
  constituentsBuffer: Buffer,
  donationsBuffer: Buffer,
  emailsBuffer: Buffer,
  includeDebug: boolean = false,
): Promise<{
  csvFiles: {
    constituents: string;
    tags: string;
  };
  debug?: {
    constituents: ProcessedConstituent[];
    tags: ProcessedTag[];
  };
}> {
  try {
    // Parse CSV files
    const constituents = parse(constituentsBuffer, { columns: true });
    const donations = parse(donationsBuffer, { columns: true });
    const emails = parse(emailsBuffer, { columns: true });

    // Fetch tag mappings
    const tagResponse = await fetch('https://6719768f7fc4c5ff8f4d84f1.mockapi.io/api/v1/tags');
    const tagMappings: TagMapping[] = await tagResponse.json();

    // Process constituents
    const processedConstituents = await Promise.all(
      constituents.map((constituent: Constituent) => processConstituent(constituent, emails, donations, tagMappings)),
    );

    // Process tags
    const processedTags = processTagCounts(processedConstituents);

    // Generate CSV strings
    const constituentsCSV = stringify(processedConstituents, {
      header: true,
      columns: Object.keys(processedConstituents[0] || {}),
    });

    const tagsCSV = stringify(processedTags, {
      header: true,
      columns: Object.keys(processedTags[0] || {}),
    });

    return {
      csvFiles: {
        constituents: constituentsCSV,
        tags: tagsCSV,
      },
      ...(includeDebug && {
        debug: {
          constituents: processedConstituents,
          tags: processedTags,
        },
      }),
    };
  } catch (error) {
    console.error('Error processing files:', error);
    throw error;
  }
}
