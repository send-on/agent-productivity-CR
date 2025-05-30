// === Types ===
export * from '../typings';

// === Tool Functions ===
import {
  getSegmentProfile,
  upsertMortgage,
  sendText,
  sendEmail,
  getMortgages,
  upsertSegmentProfile,
  mortgageCompletion,
  setSegmentProfile,
  authenticateUser,
} from '../agent/tools/toolFunctions';

export const toolFunctions = {
  authenticateUser,
  getSegmentProfile,
  upsertMortgage,
  sendText,
  sendEmail,
  getMortgages,
  upsertSegmentProfile,
  mortgageCompletion,
  setSegmentProfile,
};

// === Utilities ===
import {
  identifyMissingCols,
  airtableCols,
  getFormattedDate,
  sendToCoast,
} from '../agent/utils';

export const utils = {
  identifyMissingCols,
  airtableCols,
  getFormattedDate,
  sendToCoast,
};
