import axios from 'axios';
import dotenv from 'dotenv';
import { Types } from '../../../typings';
dotenv.config();

const SEGMENT_TOKEN = process.env.SEGMENT_TOKEN || '';
const SEGMENT_SPACE = process.env.SEGMENT_SPACE || '';

// Pull customer data and traits from Segment
export async function getSegmentProfile(
  phoneNumber: string
): Promise<Partial<Types.SegmentTraits> | null> {
  try {
    const encodedPhone = encodeURIComponent(phoneNumber);
    const URL = `https://profiles.segment.com/v1/spaces/${SEGMENT_SPACE}/collections/users/profiles/phone:${encodedPhone}/traits?limit=200`;

    console.log('URL:', URL);

    const response = await axios.get<Types.SegmentResponse>(URL, {
      auth: {
        username: SEGMENT_TOKEN,
        password: '',
      },
    });

    const { first_name, last_name, phone, email, user_id } =
      response.data.traits;

    const customerData: Partial<Types.SegmentTraits> = {
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
