import { manifest as getSegmentProfileToolManifest } from './getSegmentProfile/manifest';
import { manifest as liveAgentHandoffToolManifest } from './liveAgentHandoff/manifest';
import { manifest as updateCustomerProfileToolManifest } from './upsertSegmentProfile/manifest';
import { manifest as upsertMortgageToolManifest } from './upsertMortgage/manifest';
import { manifest as sendTextToolManifest } from './sendText/manifest';
import { manifest as sendRecapManifest } from './sendRecap/manifest';
// import { manifest as getMortgagesToolManifest } from './getMortgages/manifest';
import { manifest as mortgageCompletionToolManifest } from './mortgageCompletion/manifest';
import { manifest as setSegmentProfileToolManifest } from './setSegmentProfile/manifest';
import { manifest as authenticateUserToolManifest } from './authenticateUser/manifest';
import { Types } from '../../typings';

export const toolManifest: Types.GptToolManifest = {
  tools: [
    // getMortgagesToolManifest,
    authenticateUserToolManifest,
    getSegmentProfileToolManifest,
    liveAgentHandoffToolManifest,
    updateCustomerProfileToolManifest,
    upsertMortgageToolManifest,
    sendTextToolManifest,
    sendRecapManifest,
    mortgageCompletionToolManifest,
    setSegmentProfileToolManifest,
  ],
};
