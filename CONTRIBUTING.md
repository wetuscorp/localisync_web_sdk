# Web SDK release process

1. Build and test the canonical source. Review the explicit files.json export list,
   package declarations, licenses and archives. Commit the canonical source before
   producing a non-preview export.
2. Export to a separate clean checkout with export.py. It refuses unexpected public
   changes and never changes Git configuration. Validate a separate copy so build
   outputs do not contaminate the export. Preview exports must never be published.
3. Run the accepted candidate checks. Verify the npm account without reading its
   authentication file. Public CI requires explicit repository authorization.
4. Push the reviewed public main commit without force. When all release gates pass,
   pin its immutable version tag and publish only the localisync_sdk archive.
5. Check registry status before retrying any ambiguous upload. Verify clean registry
   installation, publish matching release assets and their hashes, and update product
   documentation/landing availability only after confirming both distribution paths.

The generator remains private and is packed only as a release development tool.
No server deployment, private CI, production data or registry credentials belong
in this source export. Later corrections require a new version, never a tag rewrite.
