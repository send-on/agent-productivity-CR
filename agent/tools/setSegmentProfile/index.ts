import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY || '';

type SegmentTraits = {
  email: string;
  phone: string;
  first_name: string;
  last_name: string;
};

// Push customer traits to Segment
export async function setSegmentProfile({
  email,
  phone,
  first_name,
  last_name,
}: SegmentTraits): Promise<void> {
  const userId = email;

  try {
    return; // REMOVE ME!!!
    await axios.post(
      'https://api.segment.io/v1/identify',
      {
        userId,
        traits: {
          phone,
          email,
          first_name,
          last_name,
        },
      },
      {
        auth: {
          username: SEGMENT_WRITE_KEY,
          password: '',
        },
      }
    );

    console.log(`Identified user in Segment:`, { userId });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `Axios error identifying user in Segment: ${error.message}`,
        error.response?.data
      );
    } else {
      console.error('Unknown error identifying user in Segment', error);
    }
  }
}
