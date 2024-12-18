import { processFiles } from './processor';
import { stringify } from 'csv-stringify/sync';

// Mock the fetch function
global.fetch = jest.fn(() =>
  Promise.resolve({
    json: () => Promise.resolve([{ name: 'Student Scholar', mapped_name: 'Scholar' }]),
  } as Response),
);

describe('processFiles', () => {
  const createCSVBuffer = (data: any[]) => {
    const csvString = stringify(data);
    return Buffer.from(csvString);
  };

  it('processes constituent data correctly', async () => {
    // Prepare test data
    const constituentsData = [
      [
        'Patron ID',
        'First Name',
        'Last Name',
        'Date Entered',
        'Primary Email',
        'Company',
        'Salutation',
        'Title',
        'Tags',
        'Gender',
      ],
      [
        '8977',
        'James',
        'Baker',
        'Jan 19, 2020',
        'walkerjeremy@long.org',
        '', // Company
        'Dr.', // Salutation
        '', // Title
        'Student Scholar',
        'Unknown', // Gender
      ],
    ];

    const donationsData = [
      ['Patron ID', 'Donation Amount', 'Donation Date', 'Payment Method', 'Campaign', 'Status'],
      ['8977', '$3,000.00', '2018-01-25', 'Credit card', 'Annual Campaign', 'Paid'],
    ];

    const emailsData = [
      ['Patron ID', 'Email'],
      ['8977', 'walkerjeremy@long.org'],
    ];

    const result = await processFiles(
      createCSVBuffer(constituentsData),
      createCSVBuffer(donationsData),
      createCSVBuffer(emailsData),
      true, // include debug output
    );

    const processedConstituent = result.debug!.constituents[0];

    // Test constituent processing
    expect(processedConstituent).toMatchObject({
      'CB Constituent ID': '8977',
      'CB Constituent Type': 'Person',
      'CB First Name': 'James',
      'CB Last Name': 'Baker',
      'CB Company Name': '',
      'CB Created At': expect.any(String),
      'CB Email 1 (Standardized)': 'walkerjeremy@long.org',
      'CB Email 2 (Standardized)': '',
      'CB Title': 'Dr.',
      'CB Tags': 'Scholar',
      'CB Background Information': 'Marital Status: Unknown',
      'CB Lifetime Donation Amount': '$3000.00',
      'CB Most Recent Donation Amount': '$3000.00',
      'CB Most Recent Donation Date': '2018-01-25T00:00:00.000Z',
    });

    // Test tag processing
    const processedTags = result.debug!.tags;
    expect(processedTags).toContainEqual({
      'CB Tag Name': 'Scholar',
      'CB Tag Count': 1,
    });
  });

  it('handles company constituents correctly', async () => {
    const constituentsData = [
      [
        'Patron ID',
        'First Name',
        'Last Name',
        'Date Entered',
        'Primary Email',
        'Company',
        'Salutation',
        'Title',
        'Tags',
        'Gender',
      ],
      ['1234', '', '', '2020-01-01', 'company@example.com', 'Test Company', '', '', '', ''],
    ];

    const result = await processFiles(
      createCSVBuffer(constituentsData),
      createCSVBuffer([['Patron ID', 'Donation Amount', 'Donation Date', 'Payment Method', 'Campaign', 'Status']]),
      createCSVBuffer([
        ['Patron ID', 'Email'],
        ['1234', 'company@example.com'],
      ]),
      true,
    );

    const processedConstituent = result.debug!.constituents[0];
    expect(processedConstituent).toMatchObject({
      'CB Constituent ID': '1234',
      'CB Constituent Type': 'Company',
      'CB First Name': '',
      'CB Last Name': '',
      'CB Company Name': 'Test Company',
    });
  });

  it('handles multiple emails correctly', async () => {
    const constituentsData = [
      [
        'Patron ID',
        'First Name',
        'Last Name',
        'Date Entered',
        'Primary Email',
        'Company',
        'Salutation',
        'Title',
        'Tags',
        'Gender',
      ],
      ['5678', 'John', 'Doe', '2020-01-01', 'primary@example.com', '', '', '', '', ''],
    ];

    const emailsData = [
      ['Patron ID', 'Email'],
      ['5678', 'primary@example.com'],
      ['5678', 'secondary@example.com'],
    ];

    const result = await processFiles(
      createCSVBuffer(constituentsData),
      createCSVBuffer([['Patron ID', 'Donation Amount', 'Donation Date', 'Payment Method', 'Campaign', 'Status']]),
      createCSVBuffer(emailsData),
      true,
    );

    const processedConstituent = result.debug!.constituents[0];
    expect(processedConstituent).toMatchObject({
      'CB Email 1 (Standardized)': 'primary@example.com',
      'CB Email 2 (Standardized)': 'secondary@example.com',
    });
  });

  it('handles invalid emails correctly', async () => {
    const constituentsData = [
      [
        'Patron ID',
        'First Name',
        'Last Name',
        'Date Entered',
        'Primary Email',
        'Company',
        'Salutation',
        'Title',
        'Tags',
        'Gender',
      ],
      ['9012', 'Jane', 'Smith', '2020-01-01', 'invalid-email', '', '', '', '', ''],
    ];

    const result = await processFiles(
      createCSVBuffer(constituentsData),
      createCSVBuffer([['Patron ID', 'Donation Amount', 'Donation Date', 'Payment Method', 'Campaign', 'Status']]),
      createCSVBuffer([
        ['Patron ID', 'Email'],
        ['9012', 'invalid-email'],
      ]),
      true,
    );

    const processedConstituent = result.debug!.constituents[0];
    expect(processedConstituent['CB Email 1 (Standardized)']).toBe('');
  });

  it('calculates lifetime donations correctly', async () => {
    const constituentsData = [
      [
        'Patron ID',
        'First Name',
        'Last Name',
        'Date Entered',
        'Primary Email',
        'Company',
        'Salutation',
        'Title',
        'Tags',
        'Gender',
      ],
      ['3456', 'Alice', 'Johnson', '2020-01-01', 'alice@example.com', '', '', '', '', ''],
    ];

    const donationsData = [
      ['Patron ID', 'Donation Amount', 'Donation Date', 'Payment Method', 'Campaign', 'Status'],
      ['3456', '$100.00', '2020-01-01', 'Credit card', 'Campaign 1', 'Paid'],
      ['3456', '$50.00', '2020-02-01', 'Credit card', 'Campaign 2', 'Refunded'],
      ['3456', '$200.00', '2020-03-01', 'Credit card', 'Campaign 3', 'Paid'],
    ];

    const result = await processFiles(
      createCSVBuffer(constituentsData),
      createCSVBuffer(donationsData),
      createCSVBuffer([
        ['Patron ID', 'Email'],
        ['3456', 'alice@example.com'],
      ]),
      true,
    );

    const processedConstituent = result.debug!.constituents[0];
    expect(processedConstituent).toMatchObject({
      'CB Lifetime Donation Amount': '$250.00',
      'CB Most Recent Donation Amount': '$200.00',
      'CB Most Recent Donation Date': expect.any(String),
    });
  });
});
