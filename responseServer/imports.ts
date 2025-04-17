// === Types ===
export * from '../typings';

// === Tool Functions ===
import {
  getSegmentProfile,
  upsertMortgage,
  sendText,
  getMortgages,
  upsertSegmentProfile,
  mortgageCompletion,
  setSegmentProfile,
} from '../agent/tools/toolFunctions';

export const toolFunctions = {
  getSegmentProfile,
  upsertMortgage,
  sendText,
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
