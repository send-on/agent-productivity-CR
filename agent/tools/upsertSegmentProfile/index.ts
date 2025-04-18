import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const SEGMENT_WRITE_KEY = process.env.SEGMENT_WRITE_KEY || '';

type UpsertSegmentProfileParams = {
  email: string;
  traits: Record<string, unknown>;
};

export async function upsertSegmentProfile({
  email,
  traits,
}: UpsertSegmentProfileParams): Promise<boolean> {
  try {
    const segmentBody = {
      userId: email,
      traits,
      writeKey: SEGMENT_WRITE_KEY,
    };

    console.log('im hereeee');
    console.log({ email, traits });
    return true; // REMOVE ME!!!

    const response = await axios.post(
      'https://api.segment.io/v1/identify',
      segmentBody,
      {
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    console.log('Successfully updated Segment profile:', response.status);
    return true;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      console.error(
        `Axios error updating Segment profile: ${error.message}`,
        error.response?.data
      );
    } else {
      console.error('Unknown error updating Segment profile:', error);
    }

    return false;
  }
}
