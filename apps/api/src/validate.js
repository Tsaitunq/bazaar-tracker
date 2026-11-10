const NAME = /^[A-Za-z0-9_]{3,16}$/;
const PROFILE_ID = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;

export const validName = (s) => NAME.test(s);
export const validProfileId = (s) => PROFILE_ID.test(s);
export const plainId = (s) => s.replace(/-/g, '').toLowerCase();
export const dashedId = (s) => plainId(s).replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5');
