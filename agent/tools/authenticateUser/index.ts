type authenticateUserParams = {
  lastNameOnProfile: string;
  lastNameProvided: string;
};

export async function authenticateUser({
  lastNameOnProfile,
  lastNameProvided,
}: authenticateUserParams) {
  console.log(arguments);
  const lastNameOnProfileCleaned = lastNameOnProfile.trim().toLowerCase();
  const lastNameProvidedCleaned = lastNameProvided.trim().toLowerCase();

  return lastNameOnProfileCleaned === lastNameProvidedCleaned;
}
