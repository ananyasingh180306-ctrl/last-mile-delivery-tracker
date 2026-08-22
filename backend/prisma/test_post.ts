async function testPost() {
  try {
    console.log('Logging in to get a fresh token...');
    const loginRes = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'customer@gmail.com',
        password: '123456'
      })
    });

    const loginData: any = await loginRes.json();
    if (!loginRes.ok) {
      throw new Error(`Login failed: ${JSON.stringify(loginData)}`);
    }

    const token = loginData.token;
    console.log('Token acquired successfully.');

    const payload = {
      pickupAddress: 'C-406, cental banglore',
      pickupPincode: '560001',
      pickupLat: 12.9716,
      pickupLng: 77.5946,
      dropAddress: 'indiranagr garden',
      dropPincode: '560038',
      dropLat: 12.9784,
      dropLng: 77.6408,
      length: 10,
      width: 10,
      height: 10,
      actualWeight: 1,
      orderType: 'B2C',
      paymentType: 'PREPAID'
    };

    console.log('Posting new order...');
    const orderRes = await fetch('http://localhost:5000/api/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(payload)
    });

    const orderData = await orderRes.json();
    if (!orderRes.ok) {
      console.error(`Order creation failed with status ${orderRes.status}:`, orderData);
    } else {
      console.log('Order created successfully!');
      console.log('Response data:', JSON.stringify(orderData, null, 2));
    }
  } catch (err: any) {
    console.error('Error posting order:', err.message);
  }
}

testPost();
