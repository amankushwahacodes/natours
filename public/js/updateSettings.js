// update data 
import axios from 'axios';  
import { showAlert } from './alerts';

// type is either password or data
export const updateSettings = async (data, type) => {
    try {
        const url = type === 'pwd' ? 'https://natours-5fkg.onrender.com/api/v1/users/updatePassword' : 'https://natours-5fkg.onrender.com/api/v1/users/updateMe'
        const res = await axios({
            method: 'PATCH',
            url,
            data
        })

        if (res.data.status === 'success') {
            showAlert('success', `${type.toUpperCase()} updated successfully !`,)
        }
        // console.log(res);
    }
    catch (err) {
        showAlert('error', err.response.data.message)
    }
}