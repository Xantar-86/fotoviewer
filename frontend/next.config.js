/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['sharp'],
  env: {
    NEXT_TELEMETRY_DISABLED: '1',
  },
}
module.exports = nextConfig
