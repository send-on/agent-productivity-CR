import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SEGMENT_TOKEN = process.env.SEGMENT_TOKEN || '';
const SEGMENT_SPACE = process.env.SEGMENT_SPACE || '';

export type SegmentTraits = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  email?: string;
  user_id?: string;
  [key: string]: any; // Optional: allow extra dynamic keys
};

type SegmentResponse = {
  traits: SegmentTraits;
};

// Pull customer data and traits from Segment
export async function getSegmentProfile(
  phoneNumber: string
): Promise<Partial<SegmentTraits> | null> {
  try {
    const encodedPhone = encodeURIComponent(phoneNumber);
    const URL = `https://profiles.segment.com/v1/spaces/${SEGMENT_SPACE}/collections/users/profiles/phone:${encodedPhone}/traits?limit=200`;

    console.log('URL:', URL);

    const response = await axios.get<SegmentResponse>(URL, {
      auth: {
        username: SEGMENT_TOKEN,
        password: '',
      },
    });

    const { first_name, last_name, phone, email, user_id } =
      response.data.traits;

    const customerData: Partial<SegmentTraits> = {
      first_name,
      last_name,
      userId: user_id,
      phone,
      email,
    };

    console.log(`Fetched segment customer:`, customerData);
    return customerData;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 404) {
        console.log('No profile found for customer, skipping');
        return null;
      }

      console.error(
        `Axios error fetching profile: ${error.message}`,
        error.response?.data
      );
    } else {
      console.error('Unknown error fetching profile', error);
    }

    return null;
  }
}
