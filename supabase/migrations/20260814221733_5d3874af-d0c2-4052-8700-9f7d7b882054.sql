UPDATE public.patients 
SET photo_url = 'https://i.postimg.cc/5ybdbGPW/307689149-393106206361446-7247751300391403949-n-removebg-preview.png' 
WHERE photo_url IS NULL OR photo_url = '';