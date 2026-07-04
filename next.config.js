/** @type {import('next').NextConfig} */
const nextConfig = {
    // Explicitly tell Next.js to externalize native node modules
    experimental: {
        serverComponentsExternalPackages: ['@huggingface/transformers', 'onnxruntime-node'],
    },
    webpack: (config, { isServer }) => {
        if (isServer) {
            // Ignore native binary files on the server build pass
            config.module.rules.push({
                test: /\.node$/,
                use: 'node-loader',
            });
        }
        return config;
    },
};

export default nextConfig;