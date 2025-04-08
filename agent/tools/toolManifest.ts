// import {manifest as getInfoViaTextToolManifest} from './getInfoViaText/manifest';

import { manifest as getCustomerToolManifest } from './getCustomer/manifest';
import { manifest as liveAgentHandoffToolManifest } from './liveAgentHandoff/manifest';
import { manifest as lookupMortgageWithPhoneToolManifest } from './lookupMortgageWithPhone/manifest';
import { manifest as updateCustomerProfileToolManifest } from './updateCustomerProfile/manifest';
import { manifest as upsertMortgageToolManifest } from './upsertMortgage/manifest';

export const toolManifest = {
  tools: [
    getCustomerToolManifest,
    liveAgentHandoffToolManifest,
    lookupMortgageWithPhoneToolManifest,
    updateCustomerProfileToolManifest,
    upsertMortgageToolManifest,
    // getInfoViaTextToolManifest,
  ],
};
