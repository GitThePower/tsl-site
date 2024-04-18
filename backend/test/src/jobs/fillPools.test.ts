import { handler } from "../../../src/jobs/fillPools";

describe('Update Pools', () => {
  it('should update the active league table with a record of Moxfield Content by User in the league', async () => {
    await handler();
  });
});
