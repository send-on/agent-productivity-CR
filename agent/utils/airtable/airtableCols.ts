export const airtableCols = [
  {
    name: 'journey_position',
    type: 'radio',
    radioOptions: [
      { label: 'Just getting started', value: 'getting started' },
      { label: 'Making offers', value: 'making offers' },
      { label: 'I signed a purchase agreement', value: 'purchase agreement' },
    ],
  },
  {
    name: 'first_name',
    type: 'text',
  },
  {
    name: 'last_name',
    type: 'text',
  },
  {
    name: 'email',
    type: 'email',
  },
  {
    name: 'phone',
    type: 'text',
  },
  {
    name: 'annual_income',
    type: 'text',
  },
  {
    name: 'house_address',
    type: 'text',
  },
  {
    name: 'house_state',
    type: 'text',
  },
  {
    name: 'house_city',
    type: 'text',
  },
  {
    name: 'house_zipcode',
    type: 'text',
  },
  {
    name: 'house_use',
    type: 'radio',
    radioOptions: [
      { label: 'Primary', value: 'primary' },
      { label: 'Rental', value: 'rental' },
      { label: 'Business', value: 'business' },
    ],
  },
  {
    name: 'house_type',
    type: 'radio',
    radioOptions: [
      { label: 'Single Family Home', value: 'single family home' },
      { label: 'Condo', value: 'condo' },
      { label: 'Townhome', value: 'townhome' },
    ],
  },
  {
    name: 'interest_rate_years',
    type: 'radio',
    radioOptions: [
      { label: '15 years', value: '15' },
      { label: '30 years', value: '30' },
    ],
  },
  {
    name: 'house_price',
    type: 'text',
  },
];
