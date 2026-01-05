'use client';

import { Amplify } from 'aws-amplify';
import { useEffect } from 'react';

const amplifyConfig = {
    Auth: {
        Cognito: {
            userPoolId: process.env.NEXT_PUBLIC_USER_POOL_ID!,
            userPoolClientId: process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID!,
        },
    },
};

export default function ConfigureAmplify() {
    useEffect(() => {
        Amplify.configure(amplifyConfig);
    }, []);

    return null;
}
