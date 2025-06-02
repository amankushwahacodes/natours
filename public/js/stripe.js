import { loadStripe } from '@stripe/stripe-js';
import axios from 'axios';
import { showAlert } from './alerts';

const stripePromise = loadStripe('pk_test_51RTM8UB4vxGrQHecg98WdYR8bbzI3JvwvwUeU0zWKErdBN3AwUYWMagdldHcKchB35qnCZzfP5YrfqUBxPbZF8xK00NiQ2aGXS');

export const bookTour = async (tourId) => {
    try {
        const stripe = await stripePromise;
        if (!stripe) {
            throw new Error('Stripe failed to load.');
        }

        // Get the session from the backend
        const sessionRes = await axios.get(`https://natours-5fkg.onrender.com/api/v1/bookings/checkout-session/${tourId}`);
        console.log(sessionRes);
        const session = sessionRes.data.session;

        // Redirect to Stripe Checkout
        const result = await stripe.redirectToCheckout({
            sessionId: session.id
        });

        if (result.error) {
            console.error(result.error.message);
        }
    } catch (err) {
        showAlert('error',err)
    }
};
