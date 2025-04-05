 # Project overview
   You are building a Reddit analytics platform, where users can get analytics of different subreddits, where they can see top contents & see category of posts;

	You will be using NextJS 14, shadcn, tailwind, Lucid icon

#Core Functionality
1. Widget that display photos in a grid.
	1. photos are managed by the photoboothdecor.com widget (Administrator)
2. End User Config panel
	1. login/register page for end users
	2. Once logged into the widget config panel, the user will see 4 TABs: Widget, backdrops, account, help
		1. WIDGET PAGE:
			1. will display the user's uniqueAPI Key (example: 3479e11c-1e19-42e5-8655-826131e0fc8a)
			2. it will show a code snippet to ## Embed the Standard Widget. (example: <iframe src="https://widget.photoboothdecor.com/embed/v1/3479e11c-1e19-42e5-8655-826131e0fc8a" style="width:100%;height:700px;border:none;"></iframe>)
			   3. ## Configure your own Custom Widget
			   4. This will create a dynamically updated iframe code snippet with the following options:
				   1. Auto Resize the iFrame Responsive: example: <iframe src="https://widget.photoboothdecor.com/embed/v1/3479e11c-1e19-42e5-8655-826131e0fc8a?" style="width:100%;height:700px;border:none;"></iframe><script async src="https://widget.photoboothdecor.com/app/widget.js"></script>
				   2. Enable a Search Field: example: <iframe src="https://widget.photoboothdecor.com/embed/v1/3479e11c-1e19-42e5-8655-826131e0fc8a?&search=1" style="width:100%;height:700px;border:none;"></iframe>
				   3. Allow customer to submit a selection via email. example: <iframe src="https://widget.photoboothdecor.com/embed/v1/3479e11c-1e19-42e5-8655-826131e0fc8a?choice=1" style="width:100%;height:700px;border:none;"></iframe>
				   4. Show all backdrops (overrides selected backdrops) example: <iframe src="https://widget.photobooth.com/embed/v1/3479e11c-1e19-42e5-8655-826131e0fc8a?&forceall=1" style="width:100%;height:700px;border:none;"></iframe>
				   5. Capture customer name. example; <iframe src="https://widget.photoboothdecor.com/embed/v1/3479e11c-1e19-42e5-8655-826131e0fc8a?&name=1" style="width:100%;height:700px;border:none;"></iframe>
				   6. Capture customer event date. example; <iframe src="https://widget.photoboothdecor.com/embed/v1/3479e11c-1e19-42e5-8655-826131e0fc8a?&date=1" style="width:100%;height:700px;border:none;"></iframe>
				   7. Override Display.
				      when selected. Text box will appear where the user can type to override the default text for the following sections:
					   1. Selection Title
					   2. Description
					   3. Submit Button
					   4. Thank you Message
					   5. How many items to load (Default 40) (Drop down menu) options are 10, 20, 30, 40, 50, 60
					   6. Example: <iframe src="https://widget.photobotohdecor.com/embed/v1/3479e11c-1e19-42e5-8655-826131e0fc8a?&title=my events title&submit=click me&thanks=Thank you so much, your chosen backdrop choice has been sent.&chunks=50" style="width:100%;height:700px;border:none;"></iframe>
		2. BACKDROP PAGE:
			1. Here it will display all a thumbnail grid of all the backdrop images
			2. there will be a "search bar" at the top 
			3. there will be 2 buttons top right
				1. Select all
				2. Select None
			4. when users click on a "thumbnail" it will toggle a "select" / "not selected" Green icon the thumbnail -Backdrops that are "selected' will show up on the end user's widget to be displayed to the public"
        3. ACCOUNT PAGE:
            1. A simple page where a user can updated their profile.
            2. Things like their:
                1. Business Name
                2. Username
                3. Password
                4. email address
                5. password update/change
        4. HELP PAGE
            1. a help page that provides simple instructions to help the end user. it should display something like:
            "Our widgets allow you to embed your chosen backdrops on your website anywhere you like!

            Generating your Widget Code
        
            From the widgets tab, simply decide whether you want to embed our standard widget, or configure your own custom widget, and copy the widget code that is generated for you.
        
            Adding Widget Code to your Website
        
            Your Widget Code can be used on any Website Builder, including Wix, Squarespace, Wordpress, 1and1, GoDaddy and hundreds more.
        
            The steps to add the Widget Code to your website differ slightly depending on the Website Builder that your business uses."
"
3. End users will be able to paste their own custom URL on their website where it will display available backdrops from photoboothdecor.com

4. Owner Admin Panel
    1. This will be a 5th page on the config panel, only accessible to the Administrator
    2. Here's where I can upload all the photos of the backdrops